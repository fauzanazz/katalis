import { describe, it, expect, vi, beforeEach } from "vitest";

vi.stubEnv("SESSION_SECRET", "a".repeat(48));

vi.mock("@/lib/auth", () => ({
  getChildSession: vi.fn(),
}));

const mockGetPublicUrl = vi.fn();
vi.mock("@/lib/storage", () => ({
  getStorageClient: () => ({
    getPublicUrl: mockGetPublicUrl,
  }),
  validateFile: vi.fn(() => ({ valid: true })),
  detectFileCategory: vi.fn(() => "image"),
}));

import { POST } from "../complete/route";
import { getChildSession } from "@/lib/auth";
import { GUEST_ID_COOKIE, signGuestId } from "@/lib/guest-id";

const mockedGetSession = vi.mocked(getChildSession);

function createRequest(body: unknown, cookie?: string) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (cookie) headers["cookie"] = cookie;
  return new Request("http://localhost:3100/api/upload/complete", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  }) as unknown as Parameters<typeof POST>[0];
}

describe("POST /api/upload/complete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPublicUrl.mockImplementation(
      (key: string) => `http://localhost:3100/uploads/${key}`,
    );
  });

  it("returns 400 for missing key", async () => {
    mockedGetSession.mockResolvedValue({ childId: "child-1" });
    const res = await POST(createRequest({ category: "image" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid category", async () => {
    mockedGetSession.mockResolvedValue({ childId: "child-1" });
    const res = await POST(
      createRequest({ key: "child/child-1/image/a.jpg", category: "video" }),
    );
    expect(res.status).toBe(400);
  });

  it("authed child can complete an upload under their own prefix", async () => {
    mockedGetSession.mockResolvedValue({ childId: "child-1" });
    const res = await POST(
      createRequest({ key: "child/child-1/image/a.jpg", category: "image" }),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.url).toContain("child/child-1/image/a.jpg");
  });

  it("authed child cannot claim a foreign child's key", async () => {
    mockedGetSession.mockResolvedValue({ childId: "child-1" });
    const res = await POST(
      createRequest({ key: "child/child-2/image/a.jpg", category: "image" }),
    );
    expect(res.status).toBe(403);
  });

  it("authed child cannot complete a guest-prefixed key", async () => {
    mockedGetSession.mockResolvedValue({ childId: "child-1" });
    const res = await POST(
      createRequest({ key: "guest/some-uuid/image/a.jpg", category: "image" }),
    );
    expect(res.status).toBe(403);
  });

  it("guest with valid cookie can complete an upload under their own guest prefix", async () => {
    mockedGetSession.mockResolvedValue(null);
    const signed = signGuestId("guest-1");
    const res = await POST(
      createRequest(
        { key: "guest/guest-1/image/a.jpg", category: "image" },
        `${GUEST_ID_COOKIE}=${signed}`,
      ),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
  });

  it("guest cannot claim a different guest's prefix", async () => {
    mockedGetSession.mockResolvedValue(null);
    const signed = signGuestId("guest-1");
    const res = await POST(
      createRequest(
        { key: "guest/guest-2/image/a.jpg", category: "image" },
        `${GUEST_ID_COOKIE}=${signed}`,
      ),
    );
    expect(res.status).toBe(403);
  });

  it("guest cannot complete a child-prefixed key", async () => {
    mockedGetSession.mockResolvedValue(null);
    const signed = signGuestId("guest-1");
    const res = await POST(
      createRequest(
        { key: "child/child-1/image/a.jpg", category: "image" },
        `${GUEST_ID_COOKIE}=${signed}`,
      ),
    );
    expect(res.status).toBe(403);
  });

  it("unauthenticated + no guest cookie is rejected with 401", async () => {
    mockedGetSession.mockResolvedValue(null);
    const res = await POST(
      createRequest({ key: "guest/guest-1/image/a.jpg", category: "image" }),
    );
    expect(res.status).toBe(401);
  });
});
