import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock auth
vi.mock("@/lib/auth", () => ({
  getSession: vi.fn(),
}));

// Mock Prisma
vi.mock("@/lib/db", () => ({
  prisma: {
    quest: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    mission: {
      update: vi.fn(),
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

import { PATCH } from "../[id]/mission/[missionId]/route";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

const mockedGetSession = vi.mocked(getSession);
const mockedQuestFindUnique = vi.mocked(prisma.quest.findUnique);
const mockedTransaction = vi.mocked(prisma.$transaction);

const validSession = {
  childId: "child-1",
  expiresAt: new Date().toISOString(),
};

function createMissions(options?: {
  day1Status?: string;
  day2Status?: string;
}) {
  const day1Status = options?.day1Status ?? "available";
  const day2Status = options?.day2Status ?? "locked";
  return Array.from({ length: 7 }, (_, i) => ({
    id: `mission-${i + 1}`,
    questId: "quest-1",
    day: i + 1,
    title: `Day ${i + 1} Mission`,
    description: `Description for day ${i + 1}`,
    instructions: JSON.stringify([`Step ${i + 1}`]),
    materials: JSON.stringify([`Material ${i + 1}`]),
    tips: JSON.stringify([`Tip ${i + 1}`]),
    status:
      i === 0
        ? day1Status
        : i === 1
          ? day2Status
          : "locked",
    proofPhotoUrl: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }));
}

const mockQuest = {
  id: "quest-1",
  childId: "child-1",
  dream: "Build robots",
  localContext: "Village near river",
  status: "active",
  missions: createMissions(),
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

function createParams(
  questId = "quest-1",
  missionId = "mission-1",
): Parameters<typeof PATCH>[1] {
  return {
    params: Promise.resolve({ id: questId, missionId }),
  };
}

describe("PATCH /api/quest/[id]/mission/[missionId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Authentication", () => {
    it("returns 401 when not authenticated", async () => {
      mockedGetSession.mockResolvedValue(null);

      const res = await PATCH(
        createRequest({ action: "start" }),
        createParams(),
      );
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toBe("unauthorized");
    });
  });

  describe("Start Mission", () => {
    it("starts an available mission (transitions to in_progress)", async () => {
      mockedGetSession.mockResolvedValue(validSession);
      mockedQuestFindUnique.mockResolvedValue(mockQuest as never);
      vi.mocked(prisma.mission.update).mockResolvedValue({
        id: "mission-1",
        day: 1,
        status: "in_progress",
      } as never);

      const res = await PATCH(
        createRequest({ action: "start" }),
        createParams(),
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.mission.status).toBe("in_progress");
    });

    it("rejects starting a locked mission", async () => {
      mockedGetSession.mockResolvedValue(validSession);
      mockedQuestFindUnique.mockResolvedValue(mockQuest as never);

      const res = await PATCH(
        createRequest({ action: "start" }),
        createParams("quest-1", "mission-2"),
      );
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe("invalid_state");
    });

    it("rejects starting an already in_progress mission", async () => {
      mockedGetSession.mockResolvedValue(validSession);
      const questWithInProgress = {
        ...mockQuest,
        missions: createMissions({ day1Status: "in_progress" }),
      };
      mockedQuestFindUnique.mockResolvedValue(
        questWithInProgress as never,
      );

      const res = await PATCH(
        createRequest({ action: "start" }),
        createParams("quest-1", "mission-1"),
      );
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe("invalid_state");
    });

    it("rejects starting a completed mission", async () => {
      mockedGetSession.mockResolvedValue(validSession);
      const questWithCompleted = {
        ...mockQuest,
        missions: createMissions({ day1Status: "completed" }),
      };
      mockedQuestFindUnique.mockResolvedValue(
        questWithCompleted as never,
      );

      const res = await PATCH(
        createRequest({ action: "start" }),
        createParams("quest-1", "mission-1"),
      );
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe("invalid_state");
    });
  });

  describe("Complete Mission", () => {
    it("completes an in_progress mission with proof photo", async () => {
      mockedGetSession.mockResolvedValue(validSession);
      const questWithInProgress = {
        ...mockQuest,
        missions: createMissions({ day1Status: "in_progress" }),
      };
      mockedQuestFindUnique.mockResolvedValue(
        questWithInProgress as never,
      );

      mockedTransaction.mockImplementation(async (fn) => {
        const tx = {
          mission: {
            update: vi.fn().mockResolvedValue({
              id: "mission-1",
              day: 1,
              status: "completed",
              proofPhotoUrl: "http://localhost:3100/uploads/proof.jpg",
            }),
            findMany: vi.fn().mockResolvedValue([
              { status: "completed" },
              { status: "available" },
              ...Array(5).fill({ status: "locked" }),
            ]),
          },
          quest: {
            update: vi.fn(),
          },
        };
        return fn(tx as never);
      });

      const res = await PATCH(
        createRequest({
          action: "complete",
          proofPhotoUrl: "http://localhost:3100/uploads/proof.jpg",
        }),
        createParams("quest-1", "mission-1"),
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.mission.status).toBe("completed");
      expect(data.nextDayUnlocked).toBe(true);
    });

    it("rejects completion without proof photo", async () => {
      mockedGetSession.mockResolvedValue(validSession);
      const questWithInProgress = {
        ...mockQuest,
        missions: createMissions({ day1Status: "in_progress" }),
      };
      mockedQuestFindUnique.mockResolvedValue(
        questWithInProgress as never,
      );

      const res = await PATCH(
        createRequest({ action: "complete" }),
        createParams("quest-1", "mission-1"),
      );
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe("missing_proof");
    });

    it("rejects completing an available mission (not started)", async () => {
      mockedGetSession.mockResolvedValue(validSession);
      mockedQuestFindUnique.mockResolvedValue(mockQuest as never);

      const res = await PATCH(
        createRequest({
          action: "complete",
          proofPhotoUrl: "http://localhost:3100/uploads/proof.jpg",
        }),
        createParams("quest-1", "mission-1"),
      );
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe("invalid_state");
    });

    it("marks quest as completed when all missions done", async () => {
      mockedGetSession.mockResolvedValue(validSession);
      const missions = Array.from({ length: 7 }, (_, i) => ({
        id: `mission-${i + 1}`,
        questId: "quest-1",
        day: i + 1,
        title: `Day ${i + 1}`,
        description: `Desc ${i + 1}`,
        instructions: "[]",
        materials: "[]",
        tips: "[]",
        status: i < 6 ? "completed" : "in_progress",
        proofPhotoUrl: i < 6 ? "http://proof.jpg" : null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }));
      const questAlmostDone = { ...mockQuest, missions };
      mockedQuestFindUnique.mockResolvedValue(
        questAlmostDone as never,
      );

      mockedTransaction.mockImplementation(async (fn) => {
        const tx = {
          mission: {
            update: vi.fn().mockResolvedValue({
              id: "mission-7",
              day: 7,
              status: "completed",
              proofPhotoUrl: "http://localhost:3100/uploads/final.jpg",
            }),
            findMany: vi
              .fn()
              .mockResolvedValue(
                Array(7).fill({ status: "completed" }),
              ),
          },
          quest: {
            update: vi.fn(),
          },
        };
        return fn(tx as never);
      });

      const res = await PATCH(
        createRequest({
          action: "complete",
          proofPhotoUrl: "http://localhost:3100/uploads/final.jpg",
        }),
        createParams("quest-1", "mission-7"),
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.questCompleted).toBe(true);
    });
  });

  describe("Quest state checks", () => {
    it("rejects updates on abandoned quests", async () => {
      mockedGetSession.mockResolvedValue(validSession);
      mockedQuestFindUnique.mockResolvedValue({
        ...mockQuest,
        status: "abandoned",
      } as never);

      const res = await PATCH(
        createRequest({ action: "start" }),
        createParams(),
      );
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe("invalid_state");
    });

    it("rejects updates on completed quests", async () => {
      mockedGetSession.mockResolvedValue(validSession);
      mockedQuestFindUnique.mockResolvedValue({
        ...mockQuest,
        status: "completed",
      } as never);

      const res = await PATCH(
        createRequest({ action: "start" }),
        createParams(),
      );
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe("invalid_state");
    });

    it("returns 404 for non-existent quest", async () => {
      mockedGetSession.mockResolvedValue(validSession);
      mockedQuestFindUnique.mockResolvedValue(null);

      const res = await PATCH(
        createRequest({ action: "start" }),
        createParams("nonexistent"),
      );
      expect(res.status).toBe(404);
    });

    it("returns 403 when accessing another child's quest", async () => {
      mockedGetSession.mockResolvedValue(validSession);
      mockedQuestFindUnique.mockResolvedValue({
        ...mockQuest,
        childId: "other-child",
      } as never);

      const res = await PATCH(
        createRequest({ action: "start" }),
        createParams(),
      );
      expect(res.status).toBe(403);
    });

    it("returns 404 for non-existent mission", async () => {
      mockedGetSession.mockResolvedValue(validSession);
      mockedQuestFindUnique.mockResolvedValue(mockQuest as never);

      const res = await PATCH(
        createRequest({ action: "start" }),
        createParams("quest-1", "nonexistent-mission"),
      );
      expect(res.status).toBe(404);
    });
  });

  describe("Validation", () => {
    it("rejects invalid action", async () => {
      mockedGetSession.mockResolvedValue(validSession);

      const res = await PATCH(
        createRequest({ action: "invalid-action" }),
        createParams(),
      );
      expect(res.status).toBe(400);
    });

    it("rejects invalid JSON body", async () => {
      mockedGetSession.mockResolvedValue(validSession);

      const req = new Request(
        "http://localhost:3100/api/quest/quest-1/mission/mission-1",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: "not valid json",
        },
      ) as unknown as Parameters<typeof PATCH>[0];

      const res = await PATCH(req, createParams());
      expect(res.status).toBe(400);
    });
  });
});
