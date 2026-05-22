import { describe, it, expect, beforeEach, vi } from "vitest";
import { createMockStorageClient } from "../mock";

describe("storage client honors pathPrefix on presigned URLs", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3100");
  });

  it("includes the pathPrefix at the start of the key when supplied", async () => {
    const client = createMockStorageClient();
    const { key } = await client.getPresignedUploadUrl({
      filename: "test.jpg",
      contentType: "image/jpeg",
      category: "image",
      pathPrefix: "guest/abc-123",
    });
    expect(key.startsWith("guest/abc-123/image/")).toBe(true);
    expect(key.endsWith(".jpg")).toBe(true);
  });

  it("falls back to category-only key when pathPrefix is omitted", async () => {
    const client = createMockStorageClient();
    const { key } = await client.getPresignedUploadUrl({
      filename: "test.jpg",
      contentType: "image/jpeg",
      category: "image",
    });
    expect(key.startsWith("image/")).toBe(true);
  });

  it("rejects a pathPrefix that contains traversal segments", async () => {
    const client = createMockStorageClient();
    await expect(
      client.getPresignedUploadUrl({
        filename: "test.jpg",
        contentType: "image/jpeg",
        category: "image",
        pathPrefix: "../escape",
      }),
    ).rejects.toThrow(/invalid path prefix/i);
  });
});
