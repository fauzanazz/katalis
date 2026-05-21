import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({
  getChildSession: vi.fn(),
}));

vi.mock("@/lib/zpd", () => ({
  recordZpdEvent: vi.fn(),
  getZpdScore: vi.fn().mockResolvedValue(0.3),
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
  summarizeReflection: vi.fn().mockResolvedValue({ summary: "Nice work", highlights: [] }),
}));

vi.mock("@/lib/badges", () => ({
  buildBadgeContext: vi.fn().mockResolvedValue({}),
  evaluateBadges: vi.fn().mockReturnValue([]),
  awardBadges: vi.fn().mockResolvedValue([]),
}));

import { POST } from "../daily/route";
import { getChildSession } from "@/lib/auth";
import { recordZpdEvent } from "@/lib/zpd";
import { prisma } from "@/lib/db";

const mockedGetSession = vi.mocked(getChildSession);
const mockedRecordZpdEvent = vi.mocked(recordZpdEvent);

const validSession = {
  childId: "child-1",
  expiresAt: new Date().toISOString(),
};

function createRequest(body: unknown) {
  return new Request("http://localhost:3100/api/reflection/daily", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as Parameters<typeof POST>[0];
}

describe("POST /api/reflection/daily → ZPD snapshot", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetSession.mockResolvedValue(validSession);
    vi.mocked(prisma.quest.findUnique).mockResolvedValue({
      id: "ckxqr1234567890abcdefghij",
      childId: validSession.childId,
    } as never);
    vi.mocked(prisma.mission.findFirst).mockResolvedValue({
      id: "mission-1",
      day: 1,
      title: "Sketch",
    } as never);
    vi.mocked(prisma.reflectionEntry.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.reflectionEntry.create).mockResolvedValue({
      id: "refl-1",
      createdAt: new Date(),
    } as never);
  });

  it("records ZPD event with completion_strong_reflection outcome on submit", async () => {
    await POST(
      createRequest({
        questId: "ckxqr1234567890abcdefghij",
        missionDay: 1,
        type: "text",
        content: "I loved building the lever today and learned a lot!",
      }),
    );

    expect(mockedRecordZpdEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        childId: validSession.childId,
        outcome: "completion_strong_reflection",
        missionId: "mission-1",
      }),
    );
  });
});
