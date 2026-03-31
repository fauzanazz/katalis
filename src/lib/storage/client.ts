/**
 * Storage client factory.
 *
 * Returns the appropriate `StorageClient` implementation based on the
 * `USE_MOCK_AI` environment variable:
 *
 *   - `USE_MOCK_AI=true`  → local filesystem mock (`public/uploads/`)
 *   - `USE_MOCK_AI=false` → Cloudflare R2 via S3-compatible SDK
 *
 * Consuming code should import `getStorageClient()` and program against
 * the shared `StorageClient` interface.
 */

import type { StorageClient } from "./types";
import { createMockStorageClient } from "./mock";
import { createR2StorageClient } from "./r2";

/** Singleton instance — created once per process. */
let _client: StorageClient | null = null;

/**
 * Returns the active storage client (singleton).
 *
 * The implementation is chosen once on first call and cached for the
 * lifetime of the process.
 */
export function getStorageClient(): StorageClient {
  if (!_client) {
    const useMock = process.env.USE_MOCK_AI === "true";
    _client = useMock ? createMockStorageClient() : createR2StorageClient();
  }
  return _client;
}

/**
 * Reset the singleton — primarily used in tests to swap implementations.
 * @internal
 */
export function _resetStorageClient(): void {
  _client = null;
}

// Re-export types for consumer convenience
export type {
  StorageClient,
  UploadFileOptions,
  UploadResult,
  PresignedUploadOptions,
  PresignedUploadUrl,
  FileCategory,
} from "./types";
