/**
 * Cloudflare R2 storage client (S3-compatible).
 *
 * Uses `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner` to
 * interact with Cloudflare R2.  Shares the same `StorageClient` interface
 * as the local mock, making them interchangeable.
 */

import { randomUUID } from "node:crypto";
import path from "node:path";
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type {
  StorageClient,
  UploadFileOptions,
  UploadResult,
  PresignedUploadOptions,
  PresignedUploadUrl,
} from "./types";
import { stripExifMetadata, isStrippableImage } from "./exif";
import { validateFile } from "./validation";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getEnvOrThrow(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function generateKey(filename: string, category: string): string {
  const ext = path.extname(filename).toLowerCase() || ".bin";
  return `${category}/${randomUUID()}${ext}`;
}

// ---------------------------------------------------------------------------
// R2 Storage Client
// ---------------------------------------------------------------------------

export function createR2StorageClient(): StorageClient {
  const accountId = getEnvOrThrow("R2_ACCOUNT_ID");
  const accessKeyId = getEnvOrThrow("R2_ACCESS_KEY_ID");
  const secretAccessKey = getEnvOrThrow("R2_SECRET_ACCESS_KEY");
  const bucketName = getEnvOrThrow("R2_BUCKET_NAME");
  const publicUrl = getEnvOrThrow("R2_PUBLIC_URL");

  const s3 = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });

  return {
    async uploadFile(options: UploadFileOptions): Promise<UploadResult> {
      const validation = validateFile(
        options.contentType,
        options.data.length,
        options.category,
      );
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      const key = generateKey(options.filename, options.category);

      // Strip EXIF metadata from images
      let data = options.data;
      if (isStrippableImage(options.contentType)) {
        data = await stripExifMetadata(data, options.contentType);
      }

      await s3.send(
        new PutObjectCommand({
          Bucket: bucketName,
          Key: key,
          Body: data,
          ContentType: options.contentType,
        }),
      );

      return {
        key,
        url: `${publicUrl}/${key}`,
      };
    },

    async getPresignedUploadUrl(
      options: PresignedUploadOptions,
    ): Promise<PresignedUploadUrl> {
      const key = generateKey(options.filename, options.category);

      const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        ContentType: options.contentType,
      });

      const url = await getSignedUrl(s3, command, { expiresIn: 3600 });

      return { url, key };
    },

    getPublicUrl(key: string): string {
      return `${publicUrl}/${key}`;
    },

    async deleteFile(key: string): Promise<void> {
      await s3.send(
        new DeleteObjectCommand({
          Bucket: bucketName,
          Key: key,
        }),
      );
    },
  };
}
