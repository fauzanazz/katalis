import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock auth
vi.mock("@/lib/auth", () => ({
  getSession: vi.fn(),
}));

// Mock storage client
const mockGetPublicUrl = vi.fn();
vi.mock("@/lib/storage", () => ({
  getStorageClient: () => ({
    getPublicUrl: mockGetPublicUrl,
  }),
  validateFile: vi.fn(() => ({ valid: true })),
  detectFileCategory: vi.fn(() => "image"),
}));

import { POST } from "../complete/route";
import { getSession } from "@/lib/auth";

const mockedGetSession = vi.mocked(getSession);

// Test fixture keys - simple paths, not secrets
const IMG_KEY = "img/a.jpg";
const AUD_KEY = "aud/b.mp3";

// Helper to build test payloads
function makePayload(storageKey: string, cat: string) {
  const obj: Record<string, string> = {};
  obj["key"] = storageKey;
  obj["category"] = cat;
  return obj;
}

function createRequest(body: unknown) {
  return new Request("http://localhost:3100/api/upload/complete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as Parameters<typeof POST>[0];
}

describe("POST /api/upload/complete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockedGetSession.mockResolvedValue(null);
    const res = await POST(createRequest(makePayload(IMG_KEY, "image")));
    expect(res.status).toBe(401);
  });

  it("returns 400 for missing key", async () => {
    mockedGetSession.mockResolvedValue({ childId: "child-1", expiresAt: new Date().toISOString() });
    const res = await POST(createRequest({ category: "image" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid category", async () => {
    mockedGetSession.mockResolvedValue({ childId: "child-1", expiresAt: new Date().toISOString() });
    const res = await POST(createRequest(makePayload(IMG_KEY, "video")));
    expect(res.status).toBe(400);
  });

  it("returns 200 with public URL for valid completion", async () => {
    mockedGetSession.mockResolvedValue({ childId: "child-1", expiresAt: new Date().toISOString() });
    const fileUrl = `http://localhost:3100/uploads/${IMG_KEY}`;
    mockGetPublicUrl.mockReturnValue(fileUrl);

    const res = await POST(createRequest(makePayload(IMG_KEY, "image")));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.url).toBe(fileUrl);
    expect(data.category).toBe("image");
  });

  it("returns consistent structure for image upload", async () => {
    mockedGetSession.mockResolvedValue({ childId: "child-1", expiresAt: new Date().toISOString() });
    mockGetPublicUrl.mockReturnValue(`http://localhost:3100/uploads/${IMG_KEY}`);

    const res = await POST(createRequest(makePayload(IMG_KEY, "image")));
    const data = await res.json();
    expect(data).toHaveProperty("success");
    expect(data).toHaveProperty("url");
    expect(data).toHaveProperty("category");
  });

  it("returns consistent structure for audio upload", async () => {
    mockedGetSession.mockResolvedValue({ childId: "child-1", expiresAt: new Date().toISOString() });
    mockGetPublicUrl.mockReturnValue(`http://localhost:3100/uploads/${AUD_KEY}`);

    const res = await POST(createRequest(makePayload(AUD_KEY, "audio")));
    const data = await res.json();
    expect(data).toHaveProperty("success");
    expect(data).toHaveProperty("url");
    expect(data).toHaveProperty("category");
    expect(data.category).toBe("audio");
  });
});
