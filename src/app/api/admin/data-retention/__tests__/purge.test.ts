import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/auth", () => ({
  getAdminSession: vi.fn(),
}));

const mockDb = vi.hoisted(() => ({
  query: {
    reflectionEntries: {
      findMany: vi.fn(),
    },
    discoveries: {
      findMany: vi.fn(),
    },
  },
  delete: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ db: mockDb }));

const mockDeleteFile = vi.fn();

vi.mock("@/lib/storage", () => ({
  getStorageClient: () => ({ deleteFile: mockDeleteFile }),
}));

import { getAdminSession } from "@/lib/auth";

// Build a chainable delete mock that returns { returning: fn }
function makeDeleteChain(returnVal: Array<{ id: string }> = []) {
  const chain = {
    where: vi.fn(),
  };
  const returning = vi.fn().mockResolvedValue(returnVal);
  chain.where.mockReturnValue({ returning });
  return chain;
}

function makeRequest(authHeader?: string) {
  return new NextRequest("http://localhost/api/admin/data-retention/purge", {
    method: "POST",
    headers: authHeader ? { authorization: authHeader } : {},
  });
}

function setupAuthorizedAsCron() {
  process.env.CRON_SECRET = "test-secret";
}

describe("POST /api/admin/data-retention/purge", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    delete process.env.CRON_SECRET;
    delete process.env.R2_PUBLIC_URL;

    mockDb.query.reflectionEntries.findMany.mockResolvedValue([]);
    mockDb.query.discoveries.findMany.mockResolvedValue([]);
    mockDb.delete.mockReturnValue(makeDeleteChain([]));
  });

  it("returns 401 when no auth provided", async () => {
    vi.mocked(getAdminSession).mockResolvedValue(null);
    const { POST } = await import("../purge/route");
    const res = await POST(makeRequest());
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("unauthorized");
  });

  it("returns 401 when wrong cron secret", async () => {
    process.env.CRON_SECRET = "real-secret";
    vi.mocked(getAdminSession).mockResolvedValue(null);
    const { POST } = await import("../purge/route");
    const res = await POST(makeRequest("Bearer wrong-secret"));
    expect(res.status).toBe(401);
  });

  it("purges mentor messages older than 180 days via cron auth", async () => {
    setupAuthorizedAsCron();
    mockDb.delete.mockReturnValue(makeDeleteChain([{ id: "m1" }, { id: "m2" }, { id: "m3" }, { id: "m4" }, { id: "m5" }]));

    const { POST } = await import("../purge/route");
    const res = await POST(makeRequest("Bearer test-secret"));

    expect(res.status).toBe(200);
    expect(mockDb.delete).toHaveBeenCalled();
  });

  it("deletes R2 files for reflection entries with fileUrl", async () => {
    setupAuthorizedAsCron();
    process.env.R2_PUBLIC_URL = "https://cdn.example.com";

    mockDb.query.reflectionEntries.findMany.mockResolvedValue([
      { fileUrl: "https://cdn.example.com/reflections/file1.webm" },
      { fileUrl: "https://cdn.example.com/reflections/file2.webm" },
    ]);

    const { POST } = await import("../purge/route");
    await POST(makeRequest("Bearer test-secret"));

    expect(mockDeleteFile).toHaveBeenCalledWith("reflections/file1.webm");
    expect(mockDeleteFile).toHaveBeenCalledWith("reflections/file2.webm");
  });

  it("does not fail batch when an R2 delete errors", async () => {
    setupAuthorizedAsCron();
    process.env.R2_PUBLIC_URL = "https://cdn.example.com";

    mockDb.query.reflectionEntries.findMany.mockResolvedValue([
      { fileUrl: "https://cdn.example.com/reflections/missing.webm" },
    ]);
    mockDeleteFile.mockRejectedValue(new Error("NoSuchKey"));

    const { POST } = await import("../purge/route");
    const res = await POST(makeRequest("Bearer test-secret"));

    expect(res.status).toBe(200);
  });

  it("purges expired rate limits", async () => {
    setupAuthorizedAsCron();

    const { POST } = await import("../purge/route");
    const res = await POST(makeRequest("Bearer test-secret"));

    expect(res.status).toBe(200);
    expect(mockDb.delete).toHaveBeenCalled();
  });

  it("returns counts for all purged categories", async () => {
    setupAuthorizedAsCron();
    // Return different sizes per call: mentorMessages=3, reflections=7, discoveries=2, interestSignals=15, rateLimits=4
    mockDb.delete
      .mockReturnValueOnce(makeDeleteChain(Array(3).fill({ id: "x" })))
      .mockReturnValueOnce(makeDeleteChain(Array(7).fill({ id: "x" })))
      .mockReturnValueOnce(makeDeleteChain(Array(2).fill({ id: "x" })))
      .mockReturnValueOnce(makeDeleteChain(Array(15).fill({ id: "x" })))
      .mockReturnValueOnce(makeDeleteChain(Array(4).fill({ id: "x" })));

    const { POST } = await import("../purge/route");
    const res = await POST(makeRequest("Bearer test-secret"));
    const body = await res.json();

    expect(body.purged).toEqual(
      expect.objectContaining({
        mentorMessages: expect.any(Number),
        reflections: expect.any(Number),
        discoveries: expect.any(Number),
        interestSignals: expect.any(Number),
        rateLimits: expect.any(Number),
      }),
    );
  });

  it("allows access via admin session", async () => {
    vi.mocked(getAdminSession).mockResolvedValue({
      userId: "admin-1",
      role: "admin",
    } as Awaited<ReturnType<typeof getAdminSession>>);

    const { POST } = await import("../purge/route");
    const res = await POST(makeRequest());

    expect(res.status).toBe(200);
  });
});
