/**
 * Local filesystem mock for the storage client.
 *
 * Saves files to `public/uploads/` and returns local URLs.
 * Used during development when `USE_MOCK_AI=true`.
 *
 * This is a drop-in replacement for the R2 client, sharing the same
 * `StorageClient` interface.
 */

import { randomUUID } from "node:crypto";
import { mkdir, writeFile, unlink, access } from "node:fs/promises";
import path from "node:path";
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

/** Root directory for local uploads (relative to project root). */
const UPLOADS_ROOT = path.join(process.cwd(), "public", "uploads");

/** Base URL used to construct public URLs for stored files. */
function getBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3100";
}

/**
 * Generate a storage key from a filename and category.
 * Format: `{category}/{uuid}.{ext}`
 */
function generateKey(filename: string, category: string): string {
  const ext = path.extname(filename).toLowerCase() || ".bin";
  return `${category}/${randomUUID()}${ext}`;
}

/**
 * Ensure the directory for a given key exists.
 */
async function ensureDir(key: string): Promise<void> {
  const dir = path.join(UPLOADS_ROOT, path.dirname(key));
  await mkdir(dir, { recursive: true });
}

// ---------------------------------------------------------------------------
// Mock Storage Client
// ---------------------------------------------------------------------------

export function createMockStorageClient(): StorageClient {
  return {
    async uploadFile(options: UploadFileOptions): Promise<UploadResult> {
      // Validate file before upload
      const validation = validateFile(
        options.contentType,
        options.data.length,
        options.category,
      );
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      const key = generateKey(options.filename, options.category);
      await ensureDir(key);

      // Strip EXIF metadata from images
      let data = options.data;
      if (isStrippableImage(options.contentType)) {
        data = await stripExifMetadata(data, options.contentType);
      }

      const filePath = path.join(UPLOADS_ROOT, key);
      await writeFile(filePath, data);

      return {
        key,
        url: `${getBaseUrl()}/uploads/${key}`,
      };
    },

    async getPresignedUploadUrl(
      options: PresignedUploadOptions,
    ): Promise<PresignedUploadUrl> {
      const key = generateKey(options.filename, options.category);

      // In mock mode, the "presigned URL" points to a local API route
      // that accepts PUT requests and saves the file.
      const url = `${getBaseUrl()}/api/storage/upload/${key}`;

      return { url, key };
    },

    getPublicUrl(key: string): string {
      return `${getBaseUrl()}/uploads/${key}`;
    },

    async deleteFile(key: string): Promise<void> {
      const filePath = path.join(UPLOADS_ROOT, key);
      try {
        await access(filePath);
        await unlink(filePath);
      } catch {
        // File doesn't exist — treat as no-op
      }
    },
  };
}
