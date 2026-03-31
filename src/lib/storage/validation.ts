/**
 * File validation utilities for the storage layer.
 *
 * Validates file type (MIME + extension) and file size before upload.
 * Both client-side and server-side code can import these validators.
 */

import type { FileCategory } from "./types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Accepted image MIME types. */
export const ACCEPTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

/** Accepted audio MIME types. */
export const ACCEPTED_AUDIO_TYPES = [
  "audio/mpeg", // .mp3
  "audio/wav",
  "audio/x-wav",
  "audio/mp4", // .m4a
  "audio/x-m4a",
] as const;

/** Human-readable labels for file format error messages. */
export const IMAGE_FORMAT_LABEL = "JPEG, PNG, WebP";
export const AUDIO_FORMAT_LABEL = "MP3, WAV, M4A";

/** Maximum file sizes in bytes. */
export const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
export const MAX_AUDIO_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

/** Human-readable size labels. */
export const MAX_IMAGE_SIZE_LABEL = "10 MB";
export const MAX_AUDIO_SIZE_LABEL = "5 MB";

// ---------------------------------------------------------------------------
// Validation result
// ---------------------------------------------------------------------------

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Detect the file category from a MIME type.
 * Returns `null` when the MIME type is not in any accepted list.
 */
export function detectFileCategory(
  contentType: string,
): FileCategory | null {
  if (
    (ACCEPTED_IMAGE_TYPES as readonly string[]).includes(contentType)
  ) {
    return "image";
  }
  if (
    (ACCEPTED_AUDIO_TYPES as readonly string[]).includes(contentType)
  ) {
    return "audio";
  }
  return null;
}

/**
 * Validate that the content type is an accepted type for the given category.
 */
export function validateFileType(
  contentType: string,
  category: FileCategory,
): ValidationResult {
  const acceptedTypes =
    category === "image" ? ACCEPTED_IMAGE_TYPES : ACCEPTED_AUDIO_TYPES;
  const formatLabel =
    category === "image" ? IMAGE_FORMAT_LABEL : AUDIO_FORMAT_LABEL;

  if (!(acceptedTypes as readonly string[]).includes(contentType)) {
    return {
      valid: false,
      error: `Unsupported ${category} format. Accepted formats: ${formatLabel}`,
    };
  }
  return { valid: true };
}

/**
 * Validate that the file size is within the limit for the given category.
 */
export function validateFileSize(
  sizeInBytes: number,
  category: FileCategory,
): ValidationResult {
  const maxSize =
    category === "image" ? MAX_IMAGE_SIZE_BYTES : MAX_AUDIO_SIZE_BYTES;
  const sizeLabel =
    category === "image" ? MAX_IMAGE_SIZE_LABEL : MAX_AUDIO_SIZE_LABEL;

  if (sizeInBytes > maxSize) {
    const actualMB = (sizeInBytes / (1024 * 1024)).toFixed(1);
    return {
      valid: false,
      error: `File too large (${actualMB} MB). Maximum allowed size: ${sizeLabel}`,
    };
  }
  return { valid: true };
}

/**
 * Run all validations (type + size) for a file.
 */
export function validateFile(
  contentType: string,
  sizeInBytes: number,
  category: FileCategory,
): ValidationResult {
  const typeResult = validateFileType(contentType, category);
  if (!typeResult.valid) return typeResult;

  const sizeResult = validateFileSize(sizeInBytes, category);
  if (!sizeResult.valid) return sizeResult;

  return { valid: true };
}
