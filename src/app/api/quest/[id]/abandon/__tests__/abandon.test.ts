import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock auth
vi.mock("@/lib/auth", () => ({
  getChildSession: vi.fn(),
}));

// Mock Prisma
vi.mock("@/lib/db", () => ({
  prisma: {
    quest: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    mission: {
      updateMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

import { POST } from "../route";
import { getChildSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

const mockedGetSession = vi.mocked(getChildSession);
const mockedQuestFindUnique = vi.mocked(prisma.quest.findUnique);
const mockedTransaction = vi.mocked(prisma.$transaction);

const validSession = {
  childId: "child-1",
  expiresAt: new Date().toISOString(),
};

const mockActiveQuest = {
  id: "quest-1",
  childId: "child-1",
  dream: "Build robots",
  localContext: "Village near river",
  status: "active",
  generatedAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
};

function createRequest() {
  return new Request(
    "http://localhost:3100/api/quest/quest-1/abandon",
    { method: "POST" },
  ) as unknown as Parameters<typeof POST>[0];
}

function createParams(questId = "quest-1"): Parameters<typeof POST>[1] {
  return {
    params: Promise.resolve({ id: questId }),
  };
}

describe("POST /api/quest/[id]/abandon", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockedGetSession.mockResolvedValue(null);

    const res = await POST(createRequest(), createParams());
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe("unauthorized");
  });

  it("returns 404 for non-existent quest", async () => {
    mockedGetSession.mockResolvedValue(validSession);
    mockedQuestFindUnique.mockResolvedValue(null);

    const res = await POST(createRequest(), createParams("nonexistent"));
    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toBe("not_found");
  });

  it("returns 403 when accessing another child's quest", async () => {
    mockedGetSession.mockResolvedValue(validSession);
    mockedQuestFindUnique.mockResolvedValue({
      ...mockActiveQuest,
      childId: "other-child",
    } as never);

    const res = await POST(createRequest(), createParams());
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toBe("forbidden");
  });

  it("rejects abandoning an already abandoned quest", async () => {
    mockedGetSession.mockResolvedValue(validSession);
    mockedQuestFindUnique.mockResolvedValue({
      ...mockActiveQuest,
      status: "abandoned",
    } as never);

    const res = await POST(createRequest(), createParams());
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("invalid_state");
  });

  it("rejects abandoning a completed quest", async () => {
    mockedGetSession.mockResolvedValue(validSession);
    mockedQuestFindUnique.mockResolvedValue({
      ...mockActiveQuest,
      status: "completed",
    } as never);

    const res = await POST(createRequest(), createParams());
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("invalid_state");
  });

  it("successfully abandons an active quest", async () => {
    mockedGetSession.mockResolvedValue(validSession);
    mockedQuestFindUnique.mockResolvedValue(mockActiveQuest as never);
    mockedTransaction.mockImplementation(async (fn) => {
      const tx = {
        quest: {
          update: vi.fn(),
        },
        mission: {
          updateMany: vi.fn(),
        },
      };
      return fn(tx as never);
    });

    const res = await POST(createRequest(), createParams());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
  });

  it("uses a transaction for abandonment", async () => {
    mockedGetSession.mockResolvedValue(validSession);
    mockedQuestFindUnique.mockResolvedValue(mockActiveQuest as never);
    mockedTransaction.mockImplementation(async (fn) => {
      const tx = {
        quest: {
          update: vi.fn(),
        },
        mission: {
          updateMany: vi.fn(),
        },
      };
      return fn(tx as never);
    });

    await POST(createRequest(), createParams());
    expect(mockedTransaction).toHaveBeenCalledTimes(1);
  });
});
