/**
 * Storage abstraction layer types.
 *
 * Both the R2 client and the local mock implement `StorageClient`.
 * The active implementation is selected at runtime based on `USE_MOCK_AI`.
 */

/** Supported file categories for validation purposes. */
export type FileCategory = "image" | "audio";

/** Result returned after a successful file upload. */
export interface UploadResult {
  /** Storage key / object name (e.g. "images/abc-123.jpg") */
  key: string;
  /** Publicly-accessible URL for the uploaded file */
  url: string;
}

/** Presigned upload URL payload returned to the client. */
export interface PresignedUploadUrl {
  /** The URL the browser should PUT the file to */
  url: string;
  /** The storage key that will identify the file after upload */
  key: string;
}

/** Options for requesting a presigned upload URL. */
export interface PresignedUploadOptions {
  /** Desired filename (used to derive the extension — not stored as-is) */
  filename: string;
  /** MIME type of the file to upload */
  contentType: string;
  /** File category, used to choose the storage prefix */
  category: FileCategory;
}

/** Options for direct server-side upload. */
export interface UploadFileOptions {
  /** Raw file data as a Buffer */
  data: Buffer;
  /** Original filename (extension is preserved, name is replaced by uuid) */
  filename: string;
  /** MIME type */
  contentType: string;
  /** File category */
  category: FileCategory;
}

/**
 * Shared interface for all storage implementations.
 *
 * Both Cloudflare R2 and the local filesystem mock implement this interface,
 * making them interchangeable at runtime.
 */
export interface StorageClient {
  /**
   * Upload a file from a server-side Buffer.
   * EXIF metadata is stripped from images before storage.
   */
  uploadFile(options: UploadFileOptions): Promise<UploadResult>;

  /**
   * Generate a presigned URL that the browser can PUT a file to directly.
   * Returns the URL and the key that identifies the stored file.
   */
  getPresignedUploadUrl(
    options: PresignedUploadOptions,
  ): Promise<PresignedUploadUrl>;

  /**
   * Return the publicly-accessible URL for a file identified by its key.
   */
  getPublicUrl(key: string): string;

  /**
   * Delete a file identified by its key.
   */
  deleteFile(key: string): Promise<void>;
}
