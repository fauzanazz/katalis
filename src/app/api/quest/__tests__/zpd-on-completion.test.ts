import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock auth
vi.mock("@/lib/auth", () => ({
  getChildSession: vi.fn(),
}));

// Mock ZPD service — the contract Session 3 must wire up
vi.mock("@/lib/zpd", () => ({
  recordZpdEvent: vi.fn(),
  getZpdScore: vi.fn().mockResolvedValue(0.3),
}));

// Minimal Prisma mock for the mission completion path
vi.mock("@/lib/db", () => {
  const findUnique = vi.fn();
  const update = vi.fn();
  const findMany = vi.fn();
  const $transaction = vi.fn(async (fn: (tx: unknown) => unknown) => {
    return fn({
      mission: { update, findMany },
      quest: { update: vi.fn() },
    });
  });
  return {
    prisma: {
      quest: { findUnique, update: vi.fn() },
      mission: { findUnique, update, findMany },
      $transaction,
    },
  };
});

vi.mock("@/lib/badges", () => ({
  buildBadgeContext: vi.fn().mockResolvedValue({}),
  evaluateBadges: vi.fn().mockReturnValue([]),
  awardBadges: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/lib/interests/quest-mapper", () => ({
  mapMissionCompletionToInterestSignals: vi.fn().mockReturnValue([]),
}));

vi.mock("@/lib/interests/ingest-service", () => ({
  ingestInterestSignals: vi.fn().mockResolvedValue(undefined),
}));

import { PATCH } from "../[id]/mission/[missionId]/route";
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
  return new Request(
    "http://localhost:3100/api/quest/quest-1/mission/mission-1",
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  ) as unknown as Parameters<typeof PATCH>[0];
}

describe("PATCH mission completion → ZPD snapshot (Session 3 contract)", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    const seedQuest = {
      id: "quest-1",
      childId: validSession.childId,
      status: "active",
      dream: "build robots",
      localContext: "village near a river",
      missions: [
        {
          id: "mission-1",
          day: 1,
          status: "in_progress",
          questId: "quest-1",
          title: "Sketch",
          description: "desc",
        },
        {
          id: "mission-2",
          day: 2,
          status: "locked",
          questId: "quest-1",
          title: "Build",
          description: "desc",
        },
      ],
    };

    vi.mocked(prisma.quest.findUnique).mockResolvedValue(seedQuest as never);
    vi.mocked(prisma.mission.update).mockResolvedValue({
      id: "mission-1",
      day: 1,
      status: "completed",
      questId: "quest-1",
    } as never);
    vi.mocked(prisma.mission.findMany).mockResolvedValue([
      { status: "completed" },
      { status: "locked" },
    ] as never);
  });

  it("calls recordZpdEvent with outcome=completion when a mission is completed", async () => {
    mockedGetSession.mockResolvedValue(validSession);

    await PATCH(
      createRequest({ action: "complete", proofPhotoUrl: "http://localhost:3100/api/storage/proof.jpg" }),
      { params: Promise.resolve({ id: "quest-1", missionId: "mission-1" }) },
    );

    expect(mockedRecordZpdEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        childId: validSession.childId,
        outcome: "completion",
        missionId: "mission-1",
      }),
    );
  });

  it("does not call recordZpdEvent when mission is merely started, not completed", async () => {
    mockedGetSession.mockResolvedValue(validSession);
    vi.mocked(prisma.mission.update).mockResolvedValue({
      id: "mission-1",
      day: 1,
      status: "in_progress",
      questId: "quest-1",
    } as never);

    await PATCH(
      createRequest({ action: "start" }),
      { params: Promise.resolve({ id: "quest-1", missionId: "mission-1" }) },
    );

    expect(mockedRecordZpdEvent).not.toHaveBeenCalled();
  });
});
