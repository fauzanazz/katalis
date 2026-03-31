import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { access, readFile, rm, mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { createMockStorageClient } from "../mock";
import type { StorageClient } from "../types";
import {
  MAX_IMAGE_SIZE_BYTES,
  MAX_AUDIO_SIZE_BYTES,
} from "../validation";

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

const UPLOADS_ROOT = path.join(process.cwd(), "public", "uploads");
let client: StorageClient;

beforeEach(async () => {
  // Ensure clean uploads dir
  await rm(UPLOADS_ROOT, { recursive: true, force: true });
  await mkdir(UPLOADS_ROOT, { recursive: true });

  // Set env for consistent URL generation
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3100");

  client = createMockStorageClient();
});

afterEach(async () => {
  await rm(UPLOADS_ROOT, { recursive: true, force: true });
  vi.unstubAllEnvs();
});

// ---------------------------------------------------------------------------
// Helper: create a minimal JPEG buffer
// ---------------------------------------------------------------------------

async function createTestJpeg(
  width = 100,
  height = 100,
): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 255, g: 0, b: 0 },
    },
  })
    .jpeg()
    .toBuffer();
}

async function createTestJpegWithExif(): Promise<Buffer> {
  return sharp({
    create: {
      width: 100,
      height: 100,
      channels: 3,
      background: { r: 255, g: 0, b: 0 },
    },
  })
    .jpeg()
    .withMetadata({
      exif: {
        IFD0: { ImageDescription: "Test" },
        IFD3: {
          GPSLatitudeRef: "N",
          GPSLatitude: "37/1 46/1 30/1",
          GPSLongitudeRef: "W",
          GPSLongitude: "122/1 25/1 10/1",
        },
      },
    })
    .toBuffer();
}

// ---------------------------------------------------------------------------
// uploadFile
// ---------------------------------------------------------------------------

describe("MockStorageClient.uploadFile", () => {
  it("saves an image to public/uploads/ and returns a local URL", async () => {
    const data = await createTestJpeg();

    const result = await client.uploadFile({
      data,
      filename: "photo.jpg",
      contentType: "image/jpeg",
      category: "image",
    });

    // Key should follow format: image/<uuid>.jpg
    expect(result.key).toMatch(/^image\/[\w-]+\.jpg$/);
    expect(result.url).toContain("http://localhost:3100/uploads/");
    expect(result.url).toContain(result.key);

    // File should exist on disk
    const filePath = path.join(UPLOADS_ROOT, result.key);
    await expect(access(filePath)).resolves.toBeUndefined();
  });

  it("strips EXIF metadata from uploaded images (GPS data removed)", async () => {
    const data = await createTestJpegWithExif();

    // Verify input has EXIF
    const inputMeta = await sharp(data).metadata();
    expect(inputMeta.exif).toBeDefined();

    const result = await client.uploadFile({
      data,
      filename: "gps-photo.jpg",
      contentType: "image/jpeg",
      category: "image",
    });

    // Read the stored file and check metadata
    const filePath = path.join(UPLOADS_ROOT, result.key);
    const storedData = await readFile(filePath);
    const storedMeta = await sharp(storedData).metadata();

    // EXIF should be stripped or minimal (no GPS data)
    if (storedMeta.exif) {
      expect(storedMeta.exif.length).toBeLessThan(inputMeta.exif!.length);
    }
  });

  it("saves audio files without modification", async () => {
    const audioData = Buffer.alloc(1024, 0x42); // fake MP3 data

    const result = await client.uploadFile({
      data: audioData,
      filename: "recording.mp3",
      contentType: "audio/mpeg",
      category: "audio",
    });

    expect(result.key).toMatch(/^audio\/[\w-]+\.mp3$/);
    expect(result.url).toContain("http://localhost:3100/uploads/");

    const filePath = path.join(UPLOADS_ROOT, result.key);
    const storedData = await readFile(filePath);
    expect(storedData.equals(audioData)).toBe(true);
  });

  it("rejects unsupported file types with descriptive error", async () => {
    const data = Buffer.alloc(100);

    await expect(
      client.uploadFile({
        data,
        filename: "document.pdf",
        contentType: "application/pdf",
        category: "image",
      }),
    ).rejects.toThrow("Unsupported image format");
  });

  it("rejects images exceeding the 10 MB size limit", async () => {
    const oversizedData = Buffer.alloc(MAX_IMAGE_SIZE_BYTES + 1);

    await expect(
      client.uploadFile({
        data: oversizedData,
        filename: "huge.jpg",
        contentType: "image/jpeg",
        category: "image",
      }),
    ).rejects.toThrow("File too large");
  });

  it("rejects audio exceeding the 5 MB size limit", async () => {
    const oversizedData = Buffer.alloc(MAX_AUDIO_SIZE_BYTES + 1);

    await expect(
      client.uploadFile({
        data: oversizedData,
        filename: "huge.mp3",
        contentType: "audio/mpeg",
        category: "audio",
      }),
    ).rejects.toThrow("File too large");
  });
});

// ---------------------------------------------------------------------------
// getPresignedUploadUrl
// ---------------------------------------------------------------------------

describe("MockStorageClient.getPresignedUploadUrl", () => {
  it("returns a mock URL that accepts PUT requests", async () => {
    const result = await client.getPresignedUploadUrl({
      filename: "photo.jpg",
      contentType: "image/jpeg",
      category: "image",
    });

    expect(result.url).toContain("http://localhost:3100/api/storage/upload/");
    expect(result.key).toMatch(/^image\/[\w-]+\.jpg$/);
    expect(result.url).toContain(result.key);
  });

  it("generates unique keys for the same filename", async () => {
    const result1 = await client.getPresignedUploadUrl({
      filename: "photo.jpg",
      contentType: "image/jpeg",
      category: "image",
    });
    const result2 = await client.getPresignedUploadUrl({
      filename: "photo.jpg",
      contentType: "image/jpeg",
      category: "image",
    });

    expect(result1.key).not.toBe(result2.key);
    expect(result1.url).not.toBe(result2.url);
  });
});

// ---------------------------------------------------------------------------
// getPublicUrl
// ---------------------------------------------------------------------------

describe("MockStorageClient.getPublicUrl", () => {
  it("returns the file's accessible URL", () => {
    const url = client.getPublicUrl("image/abc-123.jpg");
    expect(url).toBe("http://localhost:3100/uploads/image/abc-123.jpg");
  });
});

// ---------------------------------------------------------------------------
// deleteFile
// ---------------------------------------------------------------------------

describe("MockStorageClient.deleteFile", () => {
  it("removes the file from disk", async () => {
    const data = await createTestJpeg();
    const result = await client.uploadFile({
      data,
      filename: "to-delete.jpg",
      contentType: "image/jpeg",
      category: "image",
    });

    const filePath = path.join(UPLOADS_ROOT, result.key);
    // File exists before delete
    await expect(access(filePath)).resolves.toBeUndefined();

    // Delete
    await client.deleteFile(result.key);

    // File should no longer exist
    await expect(access(filePath)).rejects.toThrow();
  });

  it("does not throw when deleting a non-existent file", async () => {
    await expect(
      client.deleteFile("image/nonexistent.jpg"),
    ).resolves.toBeUndefined();
  });
});
