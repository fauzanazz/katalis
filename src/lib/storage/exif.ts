/**
 * EXIF metadata stripping utility.
 *
 * Removes all EXIF metadata (especially GPS / location data) from JPEG and
 * PNG images before they are stored.  This is critical for child safety —
 * uploaded photos must never leak a child's geographic location.
 *
 * Uses the `sharp` library which is already installed in the project.
 */

import sharp from "sharp";
import { ACCEPTED_IMAGE_TYPES } from "./validation";

/**
 * Returns `true` when the content type is a strippable image format.
 */
export function isStrippableImage(contentType: string): boolean {
  return (ACCEPTED_IMAGE_TYPES as readonly string[]).includes(contentType);
}

/**
 * Strip all EXIF / metadata from an image buffer.
 *
 * - For JPEG: removes EXIF, IPTC, XMP, ICC profile data.
 * - For PNG:  removes text chunks and ancillary metadata.
 * - For WebP: removes EXIF/XMP metadata.
 *
 * Non-image buffers are returned unchanged.
 *
 * @param data - The raw image buffer
 * @param contentType - The MIME type of the image
 * @returns A new buffer with metadata stripped, or the original buffer if not an image.
 */
export async function stripExifMetadata(
  data: Buffer,
  contentType: string,
): Promise<Buffer> {
  if (!isStrippableImage(contentType)) {
    return data;
  }

  // sharp strips metadata by default. `.rotate()` without arguments reads
  // the EXIF orientation tag and applies the rotation before the metadata
  // is discarded, keeping the image visually correct.
  const processed = await sharp(data)
    .rotate() // auto-orient using EXIF before it's stripped
    .toBuffer();

  return processed;
}
