/**
 * Storage module barrel export.
 *
 * Import from `@/lib/storage` to get the client and all helpers.
 */

export { getStorageClient, _resetStorageClient } from "./client";
export type {
  StorageClient,
  UploadFileOptions,
  UploadResult,
  PresignedUploadOptions,
  PresignedUploadUrl,
  FileCategory,
} from "./types";
export {
  validateFile,
  validateFileType,
  validateFileSize,
  detectFileCategory,
  ACCEPTED_IMAGE_TYPES,
  ACCEPTED_AUDIO_TYPES,
  MAX_IMAGE_SIZE_BYTES,
  MAX_AUDIO_SIZE_BYTES,
  MAX_IMAGE_SIZE_LABEL,
  MAX_AUDIO_SIZE_LABEL,
  IMAGE_FORMAT_LABEL,
  AUDIO_FORMAT_LABEL,
} from "./validation";
export { stripExifMetadata, isStrippableImage } from "./exif";
