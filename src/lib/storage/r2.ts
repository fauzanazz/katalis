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
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
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

function getEndpoint(): string {
  if (process.env.R2_ENDPOINT) return process.env.R2_ENDPOINT;
  return `https://${getEnvOrThrow("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com`;
}

function generateKey(
  filename: string,
  category: string,
  prefix?: string,
): string {
  const ext = path.extname(filename).toLowerCase() || ".bin";
  const base = `${category}/${randomUUID()}${ext}`;
  if (!prefix) return base;
  assertSafePrefix(prefix);
  return `${prefix}/${base}`;
}

function assertSafePrefix(prefix: string): void {
  if (
    prefix.startsWith("/") ||
    prefix.endsWith("/") ||
    prefix.includes("..") ||
    prefix.includes("//") ||
    !/^[a-zA-Z0-9/_-]+$/.test(prefix)
  ) {
    throw new Error(`Invalid path prefix: ${prefix}`);
  }
}

// ---------------------------------------------------------------------------
// R2 Storage Client
// ---------------------------------------------------------------------------

export function createR2StorageClient(): StorageClient {
  const accessKeyId = getEnvOrThrow("R2_ACCESS_KEY_ID");
  const secretAccessKey = getEnvOrThrow("R2_SECRET_ACCESS_KEY");
  const bucketName = getEnvOrThrow("R2_BUCKET_NAME");
  const publicUrl = getEnvOrThrow("R2_PUBLIC_URL");
  const endpoint = getEndpoint();

  const s3 = new S3Client({
    region: "auto",
    endpoint,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
    // MinIO requires path-style access; Cloudflare R2 works with either
    forcePathStyle: !!process.env.R2_ENDPOINT,
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
      const key = generateKey(
        options.filename,
        options.category,
        options.pathPrefix,
      );

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

    async getObjectBytes(
      key: string,
    ): Promise<{ data: Buffer; contentType: string }> {
      const res = await s3.send(
        new GetObjectCommand({ Bucket: bucketName, Key: key }),
      );
      if (!res.Body) {
        throw new Error(`Object not found: ${key}`);
      }
      const chunks: Buffer[] = [];
      for await (const chunk of res.Body as AsyncIterable<Uint8Array>) {
        chunks.push(Buffer.from(chunk));
      }
      return {
        data: Buffer.concat(chunks),
        contentType: res.ContentType ?? "application/octet-stream",
      };
    },

    async deleteFile(key: string): Promise<void> {
      await s3.send(
        new DeleteObjectCommand({
          Bucket: bucketName,
          Key: key,
        }),
      );
    },

    async listObjects(prefix: string): Promise<Array<{ key: string; lastModified: Date }>> {
      const results: Array<{ key: string; lastModified: Date }> = [];
      let continuationToken: string | undefined;
      do {
        const res = await s3.send(new ListObjectsV2Command({
          Bucket: bucketName,
          Prefix: prefix,
          ContinuationToken: continuationToken,
        }));
        for (const obj of res.Contents ?? []) {
          if (obj.Key && obj.LastModified) {
            results.push({ key: obj.Key, lastModified: obj.LastModified });
          }
        }
        continuationToken = res.NextContinuationToken;
      } while (continuationToken);
      return results;
    },
  };
}
