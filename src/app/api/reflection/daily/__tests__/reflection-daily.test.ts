import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({
  getChildSession: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    quest: { findUnique: vi.fn() },
    mission: { findFirst: vi.fn() },
    reflectionEntry: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
  },
}));

vi.mock("@/lib/ai/mentor", () => ({
  summarizeReflection: vi.fn().mockResolvedValue({ summary: "Great effort", highlights: [] }),
}));

vi.mock("@/lib/badges", () => ({
  buildBadgeContext: vi.fn().mockResolvedValue({}),
  evaluateBadges: vi.fn().mockReturnValue([]),
  awardBadges: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/lib/zpd", () => ({
  recordZpdEvent: vi.fn(),
}));

vi.mock("@/lib/sanitize", () => ({
  sanitizeInput: vi.fn((v: string) => v),
}));

vi.mock("@/lib/url-allowlist", () => ({
  isAllowedStorageUrl: vi.fn().mockReturnValue(true),
}));

vi.mock("@/lib/ai/mentor-schemas", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ai/mentor-schemas")>();
  return actual;
});

import { POST } from "../route";
import { getChildSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

const mockedGetSession = vi.mocked(getChildSession);

const VALID_CUID = "ckxqr1234567890abcdefghij";
const VALID_SESSION = { childId: "child-1", expiresAt: new Date().toISOString() };

function makeRequest(body: unknown) {
  return new Request("http://localhost:3100/api/reflection/daily", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as Parameters<typeof POST>[0];
}

describe("POST /api/reflection/daily — fileExpiresAt COPPA TTL", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetSession.mockResolvedValue(VALID_SESSION);
    vi.mocked(prisma.quest.findUnique).mockResolvedValue({
      id: VALID_CUID,
      childId: VALID_SESSION.childId,
    } as never);
    vi.mocked(prisma.mission.findFirst).mockResolvedValue({
      id: "mission-1",
      day: 1,
      title: "Build It",
    } as never);
    vi.mocked(prisma.reflectionEntry.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.reflectionEntry.create).mockResolvedValue({
      id: "refl-1",
      createdAt: new Date(),
    } as never);
  });

  it("sets fileExpiresAt ~365 days from now when fileUrl is present", async () => {
    const before = Date.now();

    const res = await POST(
      makeRequest({
        questId: VALID_CUID,
        missionDay: 1,
        type: "voice",
        content: "I recorded my voice reflection today and it was fun!",
        fileUrl: "https://storage.example.com/voice/child-1.webm",
      }),
    );

    const after = Date.now();
    expect(res.status).toBe(201);

    const createCall = vi.mocked(prisma.reflectionEntry.create).mock.calls[0][0];
    const fileExpiresAt: Date = (createCall.data as Record<string, unknown>).fileExpiresAt as Date;

    expect(fileExpiresAt).toBeInstanceOf(Date);

    const ttlMs = 365 * 24 * 60 * 60 * 1000;
    const low = new Date(before + ttlMs - 5000);
    const high = new Date(after + ttlMs + 5000);
    expect(fileExpiresAt.getTime()).toBeGreaterThanOrEqual(low.getTime());
    expect(fileExpiresAt.getTime()).toBeLessThanOrEqual(high.getTime());
  });

  it("sets fileExpiresAt to null when no fileUrl (text reflection)", async () => {
    const res = await POST(
      makeRequest({
        questId: VALID_CUID,
        missionDay: 1,
        type: "text",
        content: "I learned a lot about levers today and it was great!",
      }),
    );

    expect(res.status).toBe(201);

    const createCall = vi.mocked(prisma.reflectionEntry.create).mock.calls[0][0];
    const fileExpiresAt = (createCall.data as Record<string, unknown>).fileExpiresAt;
    expect(fileExpiresAt).toBeNull();
  });
});
