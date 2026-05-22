import { describe, it, expect, vi, beforeEach } from "vitest";

vi.stubEnv("SESSION_SECRET", "a".repeat(48));

const { mockGetPresignedUploadUrl, mockCheckRateLimit } = vi.hoisted(() => ({
  mockGetPresignedUploadUrl: vi.fn(),
  mockCheckRateLimit: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getChildSession: vi.fn(),
}));

vi.mock("@/lib/storage", () => ({
  getStorageClient: () => ({
    getPresignedUploadUrl: mockGetPresignedUploadUrl,
  }),
}));

vi.mock("@/lib/storage/validation", () => ({
  detectFileCategory: (contentType: string) => {
    if (["image/jpeg", "image/png", "image/webp"].includes(contentType))
      return "image";
    if (
      [
        "audio/mpeg",
        "audio/wav",
        "audio/x-wav",
        "audio/mp4",
        "audio/x-m4a",
      ].includes(contentType)
    )
      return "audio";
    return null;
  },
}));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: mockCheckRateLimit,
}));

import { POST } from "../presigned-url/route";
import { getChildSession } from "@/lib/auth";
import { GUEST_ID_COOKIE, signGuestId } from "@/lib/guest-id";

const mockedGetSession = vi.mocked(getChildSession);

function makeMockPresignedResult(storageKey: string) {
  return { url: `http://localhost:3100/upload/${storageKey}`, key: storageKey };
}

function createRequest(
  body: unknown,
  init: { cookie?: string; forwardedFor?: string } = {},
) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (init.cookie) headers["cookie"] = init.cookie;
  if (init.forwardedFor) headers["x-forwarded-for"] = init.forwardedFor;
  return new Request("http://localhost:3100/api/upload/presigned-url", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  }) as unknown as Parameters<typeof POST>[0];
}

describe("POST /api/upload/presigned-url", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckRateLimit.mockResolvedValue({
      limited: false,
      remaining: 9,
      resetAt: new Date(Date.now() + 60_000),
    });
  });

  it("returns 400 for missing filename", async () => {
    mockedGetSession.mockResolvedValue({ childId: "child-1" });
    const res = await POST(createRequest({ contentType: "image/jpeg" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for missing content type", async () => {
    mockedGetSession.mockResolvedValue({ childId: "child-1" });
    const res = await POST(createRequest({ filename: "test.jpg" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for unsupported file type", async () => {
    mockedGetSession.mockResolvedValue({ childId: "child-1" });
    const res = await POST(
      createRequest({
        filename: "test.exe",
        contentType: "application/octet-stream",
      }),
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("invalid_type");
  });

  it("authed child gets presigned URL with child-scoped path prefix", async () => {
    mockedGetSession.mockResolvedValue({ childId: "child-1" });
    mockGetPresignedUploadUrl.mockResolvedValue(
      makeMockPresignedResult("child/child-1/image/a.jpg"),
    );

    const res = await POST(
      createRequest({ filename: "test.jpg", contentType: "image/jpeg" }),
    );
    expect(res.status).toBe(200);
    expect(mockGetPresignedUploadUrl).toHaveBeenCalledWith(
      expect.objectContaining({ pathPrefix: "child/child-1" }),
    );
  });

  it("guest with no session gets presigned URL and a signed guest cookie", async () => {
    mockedGetSession.mockResolvedValue(null);
    mockGetPresignedUploadUrl.mockImplementation(
      async (opts: { pathPrefix?: string }) =>
        makeMockPresignedResult(`${opts.pathPrefix ?? "x"}/image/a.jpg`),
    );

    const res = await POST(
      createRequest(
        { filename: "test.jpg", contentType: "image/jpeg" },
        { forwardedFor: "1.2.3.4" },
      ),
    );
    expect(res.status).toBe(200);
    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain(`${GUEST_ID_COOKIE}=`);
    const call = mockGetPresignedUploadUrl.mock.calls[0]?.[0] as {
      pathPrefix: string;
    };
    expect(call.pathPrefix).toMatch(/^guest\/[0-9a-f-]{36}$/i);
  });

  it("guest reuses existing valid guest cookie (no new cookie issued)", async () => {
    mockedGetSession.mockResolvedValue(null);
    const signed = signGuestId("guest-abc");
    mockGetPresignedUploadUrl.mockResolvedValue(
      makeMockPresignedResult("guest/guest-abc/image/a.jpg"),
    );

    const res = await POST(
      createRequest(
        { filename: "test.jpg", contentType: "image/jpeg" },
        { cookie: `${GUEST_ID_COOKIE}=${signed}`, forwardedFor: "1.2.3.4" },
      ),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toBeNull();
    expect(mockGetPresignedUploadUrl).toHaveBeenCalledWith(
      expect.objectContaining({ pathPrefix: "guest/guest-abc" }),
    );
  });

  it("rate-limits guest presign requests by IP and returns 429", async () => {
    mockedGetSession.mockResolvedValue(null);
    mockCheckRateLimit.mockResolvedValue({
      limited: true,
      remaining: 0,
      resetAt: new Date(Date.now() + 60_000),
    });

    const res = await POST(
      createRequest(
        { filename: "test.jpg", contentType: "image/jpeg" },
        { forwardedFor: "9.9.9.9" },
      ),
    );
    expect(res.status).toBe(429);
    expect(mockCheckRateLimit).toHaveBeenCalledWith(
      expect.stringContaining("9.9.9.9"),
      "guest-presign",
    );
    expect(mockGetPresignedUploadUrl).not.toHaveBeenCalled();
  });

  it("does not rate-limit authed children via guest bucket", async () => {
    mockedGetSession.mockResolvedValue({ childId: "child-1" });
    mockGetPresignedUploadUrl.mockResolvedValue(
      makeMockPresignedResult("child/child-1/image/a.jpg"),
    );

    const res = await POST(
      createRequest(
        { filename: "test.jpg", contentType: "image/jpeg" },
        { forwardedFor: "9.9.9.9" },
      ),
    );
    expect(res.status).toBe(200);
    expect(mockCheckRateLimit).not.toHaveBeenCalledWith(
      expect.anything(),
      "guest-presign",
    );
  });

  it("returns 400 for invalid JSON body", async () => {
    mockedGetSession.mockResolvedValue({ childId: "child-1" });
    const req = new Request("http://localhost:3100/api/upload/presigned-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "invalid json",
    }) as unknown as Parameters<typeof POST>[0];
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("does not expose raw R2 credentials in response", async () => {
    mockedGetSession.mockResolvedValue({ childId: "child-1" });
    mockGetPresignedUploadUrl.mockResolvedValue(
      makeMockPresignedResult("child/child-1/image/a.jpg"),
    );
    const res = await POST(
      createRequest({ filename: "test.jpg", contentType: "image/jpeg" }),
    );
    const data = await res.json();
    const dataStr = JSON.stringify(data);
    expect(dataStr).not.toContain("R2_ACCESS_KEY_ID");
    expect(dataStr).not.toContain("R2_SECRET_ACCESS_KEY");
  });
});
