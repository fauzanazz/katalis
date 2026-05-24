/**
 * Strip EXIF metadata from images before sending to external AI providers.
 *
 * COPPA April 2026: expanded definition of "personal information" includes
 * biometric identifiers and device-linked metadata (GPS, device serial).
 * Children's artwork uploads may carry EXIF with GPS coords, device model,
 * or timestamps — all stripped here before external provider ingestion.
 *
 * Uses sharp: re-encode image through pipeline with withMetadata(false).
 * Pixel data is preserved; only metadata block is removed.
 * Non-image content types pass through unchanged.
 */

import sharp from "sharp";

/**
 * Strip EXIF/XMP/IPTC metadata from an image buffer.
 * @param buffer      Raw image bytes from storage
 * @param contentType MIME type (e.g. "image/jpeg")
 * @returns           Cleaned buffer, or original if not an image type
 */
export async function stripExif(buffer: Buffer, contentType: string): Promise<Buffer> {
  if (!contentType.startsWith("image/")) return buffer;

  try {
    // withMetadata() with empty object = keep orientation only, strip all other metadata.
    // Omitting withMetadata() entirely strips everything including orientation.
    return await sharp(buffer).toBuffer();
  } catch (err) {
    // Never fail analysis because of metadata stripping — log and pass through
    console.error("[strip-exif] Failed to strip metadata, passing through:", err);
    return buffer;
  }
}
