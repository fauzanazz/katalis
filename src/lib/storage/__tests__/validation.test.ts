import { describe, it, expect } from "vitest";
import {
  validateFileType,
  validateFileSize,
  validateFile,
  detectFileCategory,
  ACCEPTED_IMAGE_TYPES,
  ACCEPTED_AUDIO_TYPES,
  MAX_IMAGE_SIZE_BYTES,
  MAX_AUDIO_SIZE_BYTES,
} from "../validation";

// ---------------------------------------------------------------------------
// detectFileCategory
// ---------------------------------------------------------------------------

describe("detectFileCategory", () => {
  it("returns 'image' for accepted image MIME types", () => {
    for (const mime of ACCEPTED_IMAGE_TYPES) {
      expect(detectFileCategory(mime)).toBe("image");
    }
  });

  it("returns 'audio' for accepted audio MIME types", () => {
    for (const mime of ACCEPTED_AUDIO_TYPES) {
      expect(detectFileCategory(mime)).toBe("audio");
    }
  });

  it("returns null for unsupported MIME types", () => {
    expect(detectFileCategory("application/pdf")).toBeNull();
    expect(detectFileCategory("video/mp4")).toBeNull();
    expect(detectFileCategory("image/svg+xml")).toBeNull();
    expect(detectFileCategory("text/plain")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// validateFileType
// ---------------------------------------------------------------------------

describe("validateFileType", () => {
  it("accepts JPEG images", () => {
    expect(validateFileType("image/jpeg", "image")).toEqual({ valid: true });
  });

  it("accepts PNG images", () => {
    expect(validateFileType("image/png", "image")).toEqual({ valid: true });
  });

  it("accepts WebP images", () => {
    expect(validateFileType("image/webp", "image")).toEqual({ valid: true });
  });

  it("rejects unsupported image types with descriptive error", () => {
    const result = validateFileType("image/gif", "image");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Unsupported image format");
    expect(result.error).toContain("JPEG, PNG, WebP");
  });

  it("rejects non-image types as images", () => {
    const result = validateFileType("application/pdf", "image");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Unsupported image format");
  });

  it("accepts MP3 audio", () => {
    expect(validateFileType("audio/mpeg", "audio")).toEqual({ valid: true });
  });

  it("accepts WAV audio", () => {
    expect(validateFileType("audio/wav", "audio")).toEqual({ valid: true });
  });

  it("accepts M4A audio (audio/mp4)", () => {
    expect(validateFileType("audio/mp4", "audio")).toEqual({ valid: true });
  });

  it("accepts M4A audio (audio/x-m4a)", () => {
    expect(validateFileType("audio/x-m4a", "audio")).toEqual({ valid: true });
  });

  it("rejects unsupported audio types with descriptive error", () => {
    const result = validateFileType("audio/ogg", "audio");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Unsupported audio format");
    expect(result.error).toContain("MP3, WAV, M4A");
  });
});

// ---------------------------------------------------------------------------
// validateFileSize
// ---------------------------------------------------------------------------

describe("validateFileSize", () => {
  it("accepts images within the 10 MB limit", () => {
    expect(validateFileSize(1024, "image")).toEqual({ valid: true });
    expect(validateFileSize(MAX_IMAGE_SIZE_BYTES, "image")).toEqual({
      valid: true,
    });
  });

  it("rejects images over 10 MB with size information", () => {
    const oversize = MAX_IMAGE_SIZE_BYTES + 1;
    const result = validateFileSize(oversize, "image");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("File too large");
    expect(result.error).toContain("10 MB");
  });

  it("accepts audio within the 5 MB limit", () => {
    expect(validateFileSize(1024, "audio")).toEqual({ valid: true });
    expect(validateFileSize(MAX_AUDIO_SIZE_BYTES, "audio")).toEqual({
      valid: true,
    });
  });

  it("rejects audio over 5 MB with size information", () => {
    const oversize = MAX_AUDIO_SIZE_BYTES + 1;
    const result = validateFileSize(oversize, "audio");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("File too large");
    expect(result.error).toContain("5 MB");
  });
});

// ---------------------------------------------------------------------------
// validateFile (combined)
// ---------------------------------------------------------------------------

describe("validateFile", () => {
  it("passes for a valid JPEG image within size limit", () => {
    expect(validateFile("image/jpeg", 1024, "image")).toEqual({ valid: true });
  });

  it("passes for a valid MP3 audio within size limit", () => {
    expect(validateFile("audio/mpeg", 1024, "audio")).toEqual({ valid: true });
  });

  it("fails on type before checking size", () => {
    const result = validateFile(
      "application/pdf",
      MAX_IMAGE_SIZE_BYTES + 1,
      "image",
    );
    expect(result.valid).toBe(false);
    // Error should be about type, not size
    expect(result.error).toContain("Unsupported image format");
  });

  it("fails on size when type is valid", () => {
    const result = validateFile(
      "image/jpeg",
      MAX_IMAGE_SIZE_BYTES + 1,
      "image",
    );
    expect(result.valid).toBe(false);
    expect(result.error).toContain("File too large");
  });
});
