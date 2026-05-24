import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({
  getChildSession: vi.fn(),
}));

vi.mock("@/lib/zpd", () => ({
  recordZpdEvent: vi.fn(),
  getZpdScore: vi.fn().mockResolvedValue(0.3),
}));

const mockDb = vi.hoisted(() => ({
  query: {
    quests: { findFirst: vi.fn() },
    missions: { findFirst: vi.fn() },
    reflectionEntries: { findFirst: vi.fn() },
  },
  insert: vi.fn(() => ({
    values: vi.fn(() => ({
      returning: vi.fn().mockResolvedValue([{ id: "refl-1", createdAt: new Date() }]),
    })),
  })),
}));

vi.mock("@/lib/db", () => ({ db: mockDb }));

vi.mock("@/lib/ai/mentor", () => ({
  summarizeReflection: vi.fn().mockResolvedValue({ summary: "Nice work", highlights: [] }),
}));

vi.mock("@/lib/badges", () => ({
  buildBadgeContext: vi.fn().mockResolvedValue({}),
  evaluateBadges: vi.fn().mockReturnValue([]),
  awardBadges: vi.fn().mockResolvedValue([]),
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

import { POST } from "../daily/route";
import { getChildSession } from "@/lib/auth";
import { recordZpdEvent } from "@/lib/zpd";

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
    mockDb.query.quests.findFirst.mockResolvedValue({
      id: "ckxqr1234567890abcdefghij",
      childId: validSession.childId,
    });
    mockDb.query.missions.findFirst.mockResolvedValue({
      id: "mission-1",
      day: 1,
      title: "Sketch",
    });
    mockDb.query.reflectionEntries.findFirst.mockResolvedValue(null);
    mockDb.insert.mockReturnValue({
      values: vi.fn(() => ({
        returning: vi.fn().mockResolvedValue([{ id: "refl-1", createdAt: new Date() }]),
      })),
    });
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
