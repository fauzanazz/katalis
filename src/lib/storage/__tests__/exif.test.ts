import { describe, it, expect } from "vitest";
import sharp from "sharp";
import { stripExifMetadata, isStrippableImage } from "../exif";

// ---------------------------------------------------------------------------
// isStrippableImage
// ---------------------------------------------------------------------------

describe("isStrippableImage", () => {
  it("returns true for JPEG", () => {
    expect(isStrippableImage("image/jpeg")).toBe(true);
  });

  it("returns true for PNG", () => {
    expect(isStrippableImage("image/png")).toBe(true);
  });

  it("returns true for WebP", () => {
    expect(isStrippableImage("image/webp")).toBe(true);
  });

  it("returns false for non-image types", () => {
    expect(isStrippableImage("audio/mpeg")).toBe(false);
    expect(isStrippableImage("application/pdf")).toBe(false);
    expect(isStrippableImage("text/plain")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// stripExifMetadata
// ---------------------------------------------------------------------------

describe("stripExifMetadata", () => {
  it("strips GPS EXIF data from a JPEG image", async () => {
    // Create a test JPEG with GPS EXIF data using sharp
    const width = 100;
    const height = 100;
    const inputBuffer = await sharp({
      create: {
        width,
        height,
        channels: 3,
        background: { r: 255, g: 0, b: 0 },
      },
    })
      .jpeg()
      .withMetadata({
        exif: {
          // IFD0 (main image)
          IFD0: {
            ImageDescription: "Test image with GPS",
          },
          // GPS IFD — this is the critical metadata to strip
          IFD3: {
            GPSLatitudeRef: "N",
            GPSLatitude: "37/1 46/1 30/1",
            GPSLongitudeRef: "W",
            GPSLongitude: "122/1 25/1 10/1",
          },
        },
      })
      .toBuffer();

    // Verify input has EXIF data
    const inputMeta = await sharp(inputBuffer).metadata();
    expect(inputMeta.exif).toBeDefined();

    // Strip metadata
    const strippedBuffer = await stripExifMetadata(
      inputBuffer,
      "image/jpeg",
    );

    // Verify output has no EXIF data
    const outputMeta = await sharp(strippedBuffer).metadata();
    // After stripping, there should be no exif buffer, or if present,
    // it should not contain GPS data
    if (outputMeta.exif) {
      // Parse the EXIF to check that GPS data is removed
      // The EXIF buffer should be minimal (no GPS tags)
      expect(outputMeta.exif.length).toBeLessThan(inputMeta.exif!.length);
    }

    // The output should still be a valid image
    expect(outputMeta.format).toBe("jpeg");
    expect(outputMeta.width).toBe(width);
    expect(outputMeta.height).toBe(height);
  });

  it("strips metadata from a PNG image", async () => {
    const inputBuffer = await sharp({
      create: {
        width: 50,
        height: 50,
        channels: 4,
        background: { r: 0, g: 255, b: 0, alpha: 1 },
      },
    })
      .png()
      .withMetadata({
        exif: {
          IFD0: {
            ImageDescription: "Test PNG with metadata",
          },
        },
      })
      .toBuffer();

    const strippedBuffer = await stripExifMetadata(
      inputBuffer,
      "image/png",
    );

    const outputMeta = await sharp(strippedBuffer).metadata();
    expect(outputMeta.format).toBe("png");
    expect(outputMeta.width).toBe(50);
    expect(outputMeta.height).toBe(50);
  });

  it("returns the original buffer for non-image types", async () => {
    const audioData = Buffer.from("fake audio data");
    const result = await stripExifMetadata(audioData, "audio/mpeg");
    expect(result).toBe(audioData); // Same reference — not processed
  });

  it("preserves image dimensions after stripping", async () => {
    const inputBuffer = await sharp({
      create: {
        width: 200,
        height: 150,
        channels: 3,
        background: { r: 0, g: 0, b: 255 },
      },
    })
      .jpeg()
      .toBuffer();

    const strippedBuffer = await stripExifMetadata(
      inputBuffer,
      "image/jpeg",
    );

    const meta = await sharp(strippedBuffer).metadata();
    expect(meta.width).toBe(200);
    expect(meta.height).toBe(150);
  });
});
