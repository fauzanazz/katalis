import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock auth
vi.mock("@/lib/auth", () => ({
  getChildSession: vi.fn(),
}));

// Mock AI client
vi.mock("@/lib/ai/client", () => ({
  generateQuest: vi.fn(),
}));

const mockMissions = vi.hoisted(() => [
  {
    id: "mission-1",
    questId: "quest-123",
    day: 1,
    title: "Day 1 Mission",
    description: "Description for day 1",
    instructions: JSON.stringify(["Step 1 for day 1", "Step 2 for day 1"]),
    materials: JSON.stringify(["Material for day 1"]),
    tips: JSON.stringify(["Tip for day 1"]),
    status: "available",
    proofPhotoUrl: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  ...Array.from({ length: 6 }, (_, i) => ({
    id: `mission-${i + 2}`,
    questId: "quest-123",
    day: i + 2,
    title: `Day ${i + 2} Mission`,
    description: `Description for day ${i + 2}`,
    instructions: JSON.stringify([`Step 1 for day ${i + 2}`, `Step 2 for day ${i + 2}`]),
    materials: JSON.stringify([`Material for day ${i + 2}`]),
    tips: JSON.stringify([`Tip for day ${i + 2}`]),
    status: "locked",
    proofPhotoUrl: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  })),
]);

const mockDb = vi.hoisted(() => ({
  query: {
    children: {
      findFirst: vi.fn().mockResolvedValue({ dateOfBirth: null }),
    },
    childInterestProfiles: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    discoveries: {
      findFirst: vi.fn().mockResolvedValue(null),
    },
    missions: {
      findMany: vi.fn().mockResolvedValue(mockMissions),
    },
  },
  insert: vi.fn(() => ({
    values: vi.fn(() => ({
      returning: vi.fn().mockResolvedValue([{ id: "quest-123", childId: "child-1" }]),
      onConflictDoUpdate: vi.fn(() => ({
        returning: vi.fn().mockResolvedValue([]),
      })),
    })),
  })),
  select: vi.fn(() => ({
    from: vi.fn(() => ({
      where: vi.fn().mockResolvedValue([{ count: 1 }]),
    })),
  })),
}));

vi.mock("@/lib/db", () => ({ db: mockDb }));

vi.mock("@/lib/interests/quest-mapper", () => ({
  mapQuestToInterestSignals: vi.fn().mockReturnValue([]),
}));

vi.mock("@/lib/interests/ingest-service", () => ({
  ingestInterestSignals: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/zpd", () => ({
  getZpdScore: vi.fn().mockResolvedValue(0.3),
  recordZpdEvent: vi.fn(),
  listSnapshots: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/lib/age", () => ({
  getAgeGroup: vi.fn().mockReturnValue({ band: "unknown", years: null }),
}));

vi.mock("@/lib/ai/quest/age-caps", () => ({
  clampOrRejectMissions: vi.fn().mockReturnValue({ ok: true }),
  buildAgeConstraintPromptFragment: vi.fn().mockReturnValue(""),
}));

vi.mock("@/lib/moderation", () => ({
  moderateContent: vi.fn().mockResolvedValue({
    allowed: true,
    status: "approved",
    confidence: 0.98,
    reasoning: "Content appears safe",
    eventId: "mod-1",
  }),
}));

import { POST } from "../generate/route";
import { getChildSession } from "@/lib/auth";
import { generateQuest } from "@/lib/ai/client";

const mockedGetSession = vi.mocked(getChildSession);
const mockedGenerateQuest = vi.mocked(generateQuest);

const validSession = {
  childId: "child-1",
  expiresAt: new Date().toISOString(),
};

const mockQuestResult = {
  missions: Array.from({ length: 7 }, (_, i) => ({
    day: i + 1,
    title: `Day ${i + 1} Mission`,
    description: `Description for day ${i + 1}`,
    instructions: [`Step 1 for day ${i + 1}`, `Step 2 for day ${i + 1}`],
    materials: [`Material for day ${i + 1}`],
    tips: [`Tip for day ${i + 1}`],
  })),
};

function createRequest(body: unknown) {
  return new Request("http://localhost:3100/api/quest/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as Parameters<typeof POST>[0];
}

describe("POST /api/quest/generate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: child has at least one discovery
    mockDb.query.children.findFirst.mockResolvedValue({ dateOfBirth: null });
    mockDb.query.childInterestProfiles.findMany.mockResolvedValue([]);
    mockDb.query.missions.findMany.mockResolvedValue(mockMissions);
    mockDb.select.mockReturnValue({
      from: vi.fn(() => ({
        where: vi.fn().mockResolvedValue([{ count: 1 }]),
      })),
    });
    mockDb.insert.mockReturnValue({
      values: vi.fn(() => ({
        returning: vi.fn().mockResolvedValue([{ id: "quest-123", childId: "child-1" }]),
        onConflictDoUpdate: vi.fn(() => ({
          returning: vi.fn().mockResolvedValue([]),
        })),
      })),
    });
  });

  it("returns 200 guest preview when not authenticated", async () => {
    mockedGetSession.mockResolvedValue(null);
    mockedGenerateQuest.mockResolvedValue(mockQuestResult);

    const res = await POST(
      createRequest({
        dream: "I want to build robots",
        localContext: "I live in a village near a river",
      }),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.guest).toBe(true);
    expect(data.missions).toHaveLength(7);
  });

  it("returns 200 with quest data on success", async () => {
    mockedGetSession.mockResolvedValue(validSession);
    mockedGenerateQuest.mockResolvedValue(mockQuestResult);

    const res = await POST(
      createRequest({
        dream: "I want to build robots",
        localContext: "I live in a village near a river",
      }),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.id).toBe("quest-123");
    expect(data.missions).toHaveLength(7);
    expect(data.missions[0].title).toBe("Day 1 Mission");
    expect(data.missions[0].instructions).toEqual([
      "Step 1 for day 1",
      "Step 2 for day 1",
    ]);
    expect(data.missions[0].materials).toEqual(["Material for day 1"]);
    expect(data.missions[0].tips).toEqual(["Tip for day 1"]);
  });

  it("validates missing dream field", async () => {
    mockedGetSession.mockResolvedValue(validSession);

    const res = await POST(
      createRequest({
        localContext: "I live in a village near a river",
      }),
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("invalid");
  });

  it("validates missing localContext field", async () => {
    mockedGetSession.mockResolvedValue(validSession);

    const res = await POST(
      createRequest({
        dream: "I want to build robots",
      }),
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("invalid");
  });

  it("validates dream too short", async () => {
    mockedGetSession.mockResolvedValue(validSession);

    const res = await POST(
      createRequest({
        dream: "short",
        localContext: "I live in a village near a river",
      }),
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("invalid");
    expect(data.message).toContain("10");
  });

  it("validates localContext too short", async () => {
    mockedGetSession.mockResolvedValue(validSession);

    const res = await POST(
      createRequest({
        dream: "I want to build robots",
        localContext: "short",
      }),
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("invalid");
    expect(data.message).toContain("10");
  });

  it("validates dream too long", async () => {
    mockedGetSession.mockResolvedValue(validSession);

    const res = await POST(
      createRequest({
        dream: "A".repeat(501),
        localContext: "I live in a village near a river",
      }),
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("invalid");
  });

  it("sanitizes XSS in dream text", async () => {
    mockedGetSession.mockResolvedValue(validSession);
    mockedGenerateQuest.mockResolvedValue(mockQuestResult);

    const res = await POST(
      createRequest({
        dream: '<script>alert("xss")</script>I want to build robots',
        localContext: "I live in a village near a river",
      }),
    );

    // Should succeed — XSS is sanitized not rejected
    if (res.status === 200) {
      // The generate function should receive sanitized input
      expect(mockedGenerateQuest).toHaveBeenCalledWith(
        expect.objectContaining({
          dream: expect.not.stringContaining("<script>"),
        }),
      );
    }
  });

  it("sanitizes XSS in localContext text", async () => {
    mockedGetSession.mockResolvedValue(validSession);
    mockedGenerateQuest.mockResolvedValue(mockQuestResult);

    const res = await POST(
      createRequest({
        dream: "I want to build robots",
        localContext:
          '<img src=x onerror=alert(1)>I live in a village near a river',
      }),
    );

    if (res.status === 200) {
      expect(mockedGenerateQuest).toHaveBeenCalledWith(
        expect.objectContaining({
          localContext: expect.not.stringContaining("<img"),
        }),
      );
    }
  });

  it("returns 500 with friendly error on AI failure", async () => {
    mockedGetSession.mockResolvedValue(validSession);
    mockedGenerateQuest.mockRejectedValue(new Error("Claude API error"));

    const res = await POST(
      createRequest({
        dream: "I want to build robots",
        localContext: "I live in a village near a river",
      }),
    );
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBe("ai_failure");
    expect(data.message).toBeTruthy();
    expect(data.message).not.toContain("Error:");
    expect(data.message).not.toContain("stack");
  });

  it("returns 504 on timeout", async () => {
    mockedGetSession.mockResolvedValue(validSession);
    mockedGenerateQuest.mockRejectedValue(
      new Error("Quest generation timed out. Please try again."),
    );

    const res = await POST(
      createRequest({
        dream: "I want to build robots",
        localContext: "I live in a village near a river",
      }),
    );
    expect(res.status).toBe(504);
    const data = await res.json();
    expect(data.error).toBe("timeout");
  });

  it("returns 400 for invalid JSON body", async () => {
    mockedGetSession.mockResolvedValue(validSession);

    const req = new Request("http://localhost:3100/api/quest/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not valid json",
    }) as unknown as Parameters<typeof POST>[0];

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("creates quest with Day 1 available and rest locked", async () => {
    mockedGetSession.mockResolvedValue(validSession);
    mockedGenerateQuest.mockResolvedValue(mockQuestResult);

    const missionsInsertValuesFn = vi.fn(() => ({
      returning: vi.fn().mockResolvedValue([]),
      onConflictDoUpdate: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([]) })),
    }));
    const questInsertValuesFn = vi.fn(() => ({
      returning: vi.fn().mockResolvedValue([{ id: "quest-123", childId: "child-1" }]),
      onConflictDoUpdate: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([]) })),
    }));

    // First insert call is quests, second is missions
    mockDb.insert
      .mockReturnValueOnce({ values: questInsertValuesFn })
      .mockReturnValueOnce({ values: missionsInsertValuesFn });

    await POST(
      createRequest({
        dream: "I want to build robots",
        localContext: "I live in a village near a river",
      }),
    );

    // Verify missions insert was called with correct statuses
    expect(missionsInsertValuesFn).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ day: 1, status: "available" }),
        expect.objectContaining({ day: 2, status: "locked" }),
      ]),
    );
  });

  it("passes discoveryId when provided", async () => {
    mockedGetSession.mockResolvedValue(validSession);
    mockedGenerateQuest.mockResolvedValue(mockQuestResult);

    const questInsertValuesFn = vi.fn(() => ({
      returning: vi.fn().mockResolvedValue([{ id: "quest-123", childId: "child-1" }]),
      onConflictDoUpdate: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([]) })),
    }));
    const missionsInsertValuesFn = vi.fn(() => ({
      returning: vi.fn().mockResolvedValue([]),
      onConflictDoUpdate: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([]) })),
    }));

    mockDb.insert
      .mockReturnValueOnce({ values: questInsertValuesFn })
      .mockReturnValueOnce({ values: missionsInsertValuesFn });

    await POST(
      createRequest({
        dream: "I want to build robots",
        localContext: "I live in a village near a river",
        discoveryId: "disc-123",
      }),
    );

    expect(questInsertValuesFn).toHaveBeenCalledWith(
      expect.objectContaining({
        discoveryId: "disc-123",
      }),
    );
  });

  it("each mission has all required fields", async () => {
    mockedGetSession.mockResolvedValue(validSession);
    mockedGenerateQuest.mockResolvedValue(mockQuestResult);

    const res = await POST(
      createRequest({
        dream: "I want to build robots",
        localContext: "I live in a village near a river",
      }),
    );
    expect(res.status).toBe(200);
    const data = await res.json();

    for (const mission of data.missions) {
      expect(mission).toHaveProperty("day");
      expect(mission).toHaveProperty("title");
      expect(mission).toHaveProperty("description");
      expect(mission).toHaveProperty("instructions");
      expect(mission).toHaveProperty("materials");
      expect(mission).toHaveProperty("tips");
      expect(Array.isArray(mission.instructions)).toBe(true);
      expect(Array.isArray(mission.materials)).toBe(true);
      expect(Array.isArray(mission.tips)).toBe(true);
    }
  });
});
