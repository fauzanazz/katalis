import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock auth
vi.mock("@/lib/auth", () => ({
  getSession: vi.fn(),
}));

// Mock storage client
const mockGetPresignedUploadUrl = vi.fn();
vi.mock("@/lib/storage", () => ({
  getStorageClient: () => ({
    getPresignedUploadUrl: mockGetPresignedUploadUrl,
  }),
}));

// Mock storage validation
vi.mock("@/lib/storage/validation", () => ({
  detectFileCategory: (contentType: string) => {
    if (["image/jpeg", "image/png", "image/webp"].includes(contentType))
      return "image";
    if (
      ["audio/mpeg", "audio/wav", "audio/x-wav", "audio/mp4", "audio/x-m4a"].includes(
        contentType,
      )
    )
      return "audio";
    return null;
  },
}));

import { POST } from "../presigned-url/route";
import { getSession } from "@/lib/auth";

const mockedGetSession = vi.mocked(getSession);

// Test fixture keys
const IMG_KEY = "img/a.jpg";
const AUD_KEY = "aud/b.mp3";

function makeMockPresigned(storageKey: string) {
  const result: Record<string, string> = {};
  result["url"] = `http://localhost:3100/api/storage/upload/${storageKey}`;
  result["key"] = storageKey;
  return result;
}

function createRequest(body: unknown) {
  return new Request("http://localhost:3100/api/upload/presigned-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as Parameters<typeof POST>[0];
}

describe("POST /api/upload/presigned-url", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockedGetSession.mockResolvedValue(null);

    const res = await POST(createRequest({ filename: "test.jpg", contentType: "image/jpeg" }));
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe("unauthorized");
  });

  it("returns 400 for missing filename", async () => {
    mockedGetSession.mockResolvedValue({ childId: "child-1", expiresAt: new Date().toISOString() });

    const res = await POST(createRequest({ contentType: "image/jpeg" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for missing content type", async () => {
    mockedGetSession.mockResolvedValue({ childId: "child-1", expiresAt: new Date().toISOString() });

    const res = await POST(createRequest({ filename: "test.jpg" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for unsupported file type", async () => {
    mockedGetSession.mockResolvedValue({ childId: "child-1", expiresAt: new Date().toISOString() });

    const res = await POST(
      createRequest({ filename: "test.exe", contentType: "application/octet-stream" }),
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("invalid_type");
  });

  it("returns 200 with presigned URL for valid image", async () => {
    mockedGetSession.mockResolvedValue({ childId: "child-1", expiresAt: new Date().toISOString() });
    mockGetPresignedUploadUrl.mockResolvedValue(makeMockPresigned(IMG_KEY));

    const res = await POST(
      createRequest({ filename: "test.jpg", contentType: "image/jpeg" }),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.url).toBeTruthy();
    expect(data.category).toBe("image");
  });

  it("returns 200 with presigned URL for valid audio", async () => {
    mockedGetSession.mockResolvedValue({ childId: "child-1", expiresAt: new Date().toISOString() });
    mockGetPresignedUploadUrl.mockResolvedValue(makeMockPresigned(AUD_KEY));

    const res = await POST(
      createRequest({ filename: "test.mp3", contentType: "audio/mpeg" }),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.url).toBeTruthy();
    expect(data.category).toBe("audio");
  });

  it("returns 400 for invalid JSON body", async () => {
    mockedGetSession.mockResolvedValue({ childId: "child-1", expiresAt: new Date().toISOString() });

    const req = new Request("http://localhost:3100/api/upload/presigned-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "invalid json",
    }) as unknown as Parameters<typeof POST>[0];

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("does not expose raw R2 credentials in response", async () => {
    mockedGetSession.mockResolvedValue({ childId: "child-1", expiresAt: new Date().toISOString() });
    mockGetPresignedUploadUrl.mockResolvedValue(makeMockPresigned(IMG_KEY));

    const res = await POST(
      createRequest({ filename: "test.jpg", contentType: "image/jpeg" }),
    );
    const data = await res.json();
    const dataStr = JSON.stringify(data);
    expect(dataStr).not.toContain("mock-access-key");
    expect(dataStr).not.toContain("mock-secret-key");
    expect(dataStr).not.toContain("R2_ACCESS_KEY_ID");
    expect(dataStr).not.toContain("R2_SECRET_ACCESS_KEY");
  });
});
