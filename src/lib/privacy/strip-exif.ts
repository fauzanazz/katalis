/**
 * Prepare a stored image for an external AI provider (moderation, analysis).
 *
 * Two jobs:
 *  1. Cap dimensions + re-encode to JPEG so the inline payload stays small.
 *     Full-resolution child artwork (multi-MB PNGs) otherwise pushes the
 *     provider call past its 30s timeout — moderation then fails closed (403)
 *     and analysis throws (504), blocking discovery.
 *  2. Drop EXIF (GPS/device/timestamp) as a side effect of re-encoding. COPPA
 *     April 2026 expands PII to device metadata. (Uploads are already stripped
 *     by lib/storage/exif; this is defense in depth before external egress.)
 *
 * Non-image content types pass through unchanged.
 */

import sharp from "sharp";

// Gemini samples images down to ~1568px tiles; larger inputs add payload and
// latency without improving accuracy.
const MAX_DIMENSION = 1568;
const JPEG_QUALITY = 82;

export async function sanitizeImageForAI(
  buffer: Buffer,
  contentType: string,
): Promise<{ data: Buffer; contentType: string }> {
  if (!contentType.startsWith("image/")) return { data: buffer, contentType };

  try {
    const data = await sharp(buffer)
      // Bake EXIF orientation into pixels before the metadata block is dropped.
      .rotate()
      .resize(MAX_DIMENSION, MAX_DIMENSION, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: JPEG_QUALITY })
      .toBuffer();
    return { data, contentType: "image/jpeg" };
  } catch (err) {
    // Never fail analysis because of image prep — log and pass through.
    console.error("[sanitize-image] re-encode failed, passing through:", err);
    return { data: buffer, contentType };
  }
}
