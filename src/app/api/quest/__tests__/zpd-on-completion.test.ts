import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock auth
vi.mock("@/lib/auth", () => ({
  getChildSession: vi.fn(),
}));

// Mock ZPD service — the contract Session 3 must wire up
vi.mock("@/lib/zpd", () => ({
  recordZpdEvent: vi.fn().mockResolvedValue(undefined),
  getZpdScore: vi.fn().mockResolvedValue(0.3),
}));

const mockDb = vi.hoisted(() => ({
  query: {
    quests: {
      findFirst: vi.fn(),
    },
    mentorSessions: {
      findFirst: vi.fn().mockResolvedValue(null),
    },
  },
  update: vi.fn(() => ({
    set: vi.fn(() => ({
      where: vi.fn(() => ({
        returning: vi.fn().mockResolvedValue([]),
      })),
    })),
  })),
  insert: vi.fn(() => ({
    values: vi.fn().mockResolvedValue(undefined),
  })),
  transaction: vi.fn(async (fn: (tx: unknown) => unknown) => {
    const tx = {
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn(() => ({
            returning: vi.fn().mockResolvedValue([{
              id: "mission-1",
              day: 1,
              status: "completed",
              proofPhotoUrl: "http://localhost:3100/api/storage/proof.jpg",
            }]),
          })),
        })),
      })),
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn().mockResolvedValue([
            { status: "completed" },
            { status: "locked" },
          ]),
        })),
      })),
    };
    return fn(tx);
  }),
}));

vi.mock("@/lib/db", () => ({ db: mockDb }));

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

vi.mock("@/lib/interests/mission-reassessment", () => ({
  assessMissionEngagement: vi.fn().mockReturnValue({ scale: 1, emitFrustration: false }),
  applyAssessmentToSignals: vi.fn((signals: unknown[]) => signals),
}));

import { PATCH } from "../[id]/mission/[missionId]/route";
import { getChildSession } from "@/lib/auth";
import { recordZpdEvent } from "@/lib/zpd";

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

    mockDb.query.quests.findFirst.mockResolvedValue(seedQuest);
    mockDb.query.mentorSessions.findFirst.mockResolvedValue(null);

    // Default update chain for "start" action
    mockDb.update.mockReturnValue({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          returning: vi.fn().mockResolvedValue([{
            id: "mission-1",
            day: 1,
            status: "in_progress",
            questId: "quest-1",
          }]),
        })),
      })),
    });

    // Default transaction for "complete" action
    mockDb.transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
      const tx = {
        update: vi.fn(() => ({
          set: vi.fn(() => ({
            where: vi.fn(() => ({
              returning: vi.fn().mockResolvedValue([{
                id: "mission-1",
                day: 1,
                status: "completed",
                proofPhotoUrl: "http://localhost:3100/api/storage/proof.jpg",
              }]),
            })),
          })),
        })),
        select: vi.fn(() => ({
          from: vi.fn(() => ({
            where: vi.fn().mockResolvedValue([
              { status: "completed" },
              { status: "locked" },
            ]),
          })),
        })),
      };
      return fn(tx);
    });

    mockDb.insert.mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    });
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

    // Override quest to have mission-1 as "available" for start action
    mockDb.query.quests.findFirst.mockResolvedValue({
      id: "quest-1",
      childId: validSession.childId,
      status: "active",
      dream: "build robots",
      localContext: "village near a river",
      missions: [
        {
          id: "mission-1",
          day: 1,
          status: "available",
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
    });

    await PATCH(
      createRequest({ action: "start" }),
      { params: Promise.resolve({ id: "quest-1", missionId: "mission-1" }) },
    );

    expect(mockedRecordZpdEvent).not.toHaveBeenCalled();
  });
});
