import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/auth", () => ({
  getAdminSession: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    mentorMessage: { deleteMany: vi.fn() },
    reflectionEntry: { findMany: vi.fn(), deleteMany: vi.fn() },
    discovery: { findMany: vi.fn(), deleteMany: vi.fn() },
    interestSignal: { deleteMany: vi.fn() },
    rateLimit: { deleteMany: vi.fn() },
  },
}));

const mockDeleteFile = vi.fn();

vi.mock("@/lib/storage", () => ({
  getStorageClient: () => ({ deleteFile: mockDeleteFile }),
}));

import { getAdminSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

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
    vi.mocked(prisma.mentorMessage.deleteMany).mockResolvedValue({ count: 0 });
    vi.mocked(prisma.reflectionEntry.findMany).mockResolvedValue([]);
    vi.mocked(prisma.reflectionEntry.deleteMany).mockResolvedValue({ count: 0 });
    vi.mocked(prisma.discovery.findMany).mockResolvedValue([]);
    vi.mocked(prisma.discovery.deleteMany).mockResolvedValue({ count: 0 });
    vi.mocked(prisma.interestSignal.deleteMany).mockResolvedValue({ count: 0 });
    vi.mocked(prisma.rateLimit.deleteMany).mockResolvedValue({ count: 0 });
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
    vi.mocked(prisma.mentorMessage.deleteMany).mockResolvedValue({ count: 5 });

    const { POST } = await import("../purge/route");
    const res = await POST(makeRequest("Bearer test-secret"));

    expect(res.status).toBe(200);
    expect(prisma.mentorMessage.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          createdAt: expect.objectContaining({ lt: expect.any(Date) }),
        }),
      }),
    );
  });

  it("deletes R2 files for reflection entries with fileUrl", async () => {
    setupAuthorizedAsCron();
    process.env.R2_PUBLIC_URL = "https://cdn.example.com";

    vi.mocked(prisma.reflectionEntry.findMany).mockResolvedValue([
      {
        id: "r1",
        childId: "c1",
        questId: "q1",
        missionDay: 1,
        type: "voice",
        content: "",
        fileUrl: "https://cdn.example.com/reflections/file1.webm",
        fileExpiresAt: null,
        aiSummary: null,
        createdAt: new Date(),
      },
      {
        id: "r2",
        childId: "c1",
        questId: "q1",
        missionDay: 2,
        type: "voice",
        content: "",
        fileUrl: "https://cdn.example.com/reflections/file2.webm",
        fileExpiresAt: null,
        aiSummary: null,
        createdAt: new Date(),
      },
    ]);

    const { POST } = await import("../purge/route");
    await POST(makeRequest("Bearer test-secret"));

    expect(mockDeleteFile).toHaveBeenCalledWith("reflections/file1.webm");
    expect(mockDeleteFile).toHaveBeenCalledWith("reflections/file2.webm");
  });

  it("does not fail batch when an R2 delete errors", async () => {
    setupAuthorizedAsCron();
    process.env.R2_PUBLIC_URL = "https://cdn.example.com";

    vi.mocked(prisma.reflectionEntry.findMany).mockResolvedValue([
      {
        id: "r1",
        childId: "c1",
        questId: "q1",
        missionDay: 1,
        type: "voice",
        content: "",
        fileUrl: "https://cdn.example.com/reflections/missing.webm",
        fileExpiresAt: null,
        aiSummary: null,
        createdAt: new Date(),
      },
    ]);
    mockDeleteFile.mockRejectedValue(new Error("NoSuchKey"));

    const { POST } = await import("../purge/route");
    const res = await POST(makeRequest("Bearer test-secret"));

    expect(res.status).toBe(200);
  });

  it("purges expired rate limits", async () => {
    setupAuthorizedAsCron();

    const { POST } = await import("../purge/route");
    await POST(makeRequest("Bearer test-secret"));

    expect(prisma.rateLimit.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          resetAt: expect.objectContaining({ lt: expect.any(Date) }),
        }),
      }),
    );
  });

  it("returns counts for all purged categories", async () => {
    setupAuthorizedAsCron();
    vi.mocked(prisma.mentorMessage.deleteMany).mockResolvedValue({ count: 3 });
    vi.mocked(prisma.reflectionEntry.deleteMany).mockResolvedValue({ count: 7 });
    vi.mocked(prisma.discovery.deleteMany).mockResolvedValue({ count: 2 });
    vi.mocked(prisma.interestSignal.deleteMany).mockResolvedValue({ count: 15 });
    vi.mocked(prisma.rateLimit.deleteMany).mockResolvedValue({ count: 4 });

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
