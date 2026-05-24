import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock auth
vi.mock("@/lib/auth", () => ({
  getChildSession: vi.fn(),
}));

const mockDb = vi.hoisted(() => ({
  query: {
    quests: {
      findFirst: vi.fn(),
    },
  },
  transaction: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ db: mockDb }));

import { POST } from "../route";
import { getChildSession } from "@/lib/auth";

const mockedGetSession = vi.mocked(getChildSession);

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
    mockDb.query.quests.findFirst.mockResolvedValue(null);

    const res = await POST(createRequest(), createParams("nonexistent"));
    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toBe("not_found");
  });

  it("returns 403 when accessing another child's quest", async () => {
    mockedGetSession.mockResolvedValue(validSession);
    mockDb.query.quests.findFirst.mockResolvedValue({
      ...mockActiveQuest,
      childId: "other-child",
    });

    const res = await POST(createRequest(), createParams());
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toBe("forbidden");
  });

  it("rejects abandoning an already abandoned quest", async () => {
    mockedGetSession.mockResolvedValue(validSession);
    mockDb.query.quests.findFirst.mockResolvedValue({
      ...mockActiveQuest,
      status: "abandoned",
    });

    const res = await POST(createRequest(), createParams());
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("invalid_state");
  });

  it("rejects abandoning a completed quest", async () => {
    mockedGetSession.mockResolvedValue(validSession);
    mockDb.query.quests.findFirst.mockResolvedValue({
      ...mockActiveQuest,
      status: "completed",
    });

    const res = await POST(createRequest(), createParams());
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("invalid_state");
  });

  it("successfully abandons an active quest", async () => {
    mockedGetSession.mockResolvedValue(validSession);
    mockDb.query.quests.findFirst.mockResolvedValue(mockActiveQuest);
    mockDb.transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
      const tx = {
        update: vi.fn(() => ({
          set: vi.fn(() => ({
            where: vi.fn().mockResolvedValue(undefined),
          })),
        })),
      };
      return fn(tx);
    });

    const res = await POST(createRequest(), createParams());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
  });

  it("uses a transaction for abandonment", async () => {
    mockedGetSession.mockResolvedValue(validSession);
    mockDb.query.quests.findFirst.mockResolvedValue(mockActiveQuest);
    mockDb.transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
      const tx = {
        update: vi.fn(() => ({
          set: vi.fn(() => ({
            where: vi.fn().mockResolvedValue(undefined),
          })),
        })),
      };
      return fn(tx);
    });

    await POST(createRequest(), createParams());
    expect(mockDb.transaction).toHaveBeenCalledTimes(1);
  });
});
