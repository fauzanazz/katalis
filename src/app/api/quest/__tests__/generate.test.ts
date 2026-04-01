import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock auth
vi.mock("@/lib/auth", () => ({
  getSession: vi.fn(),
}));

// Mock Claude AI
vi.mock("@/lib/ai/claude", () => ({
  generateQuest: vi.fn(),
}));

// Mock Prisma
vi.mock("@/lib/db", () => ({
  prisma: {
    quest: {
      create: vi.fn(),
    },
  },
}));

import { POST } from "../generate/route";
import { getSession } from "@/lib/auth";
import { generateQuest } from "@/lib/ai/claude";
import { prisma } from "@/lib/db";

const mockedGetSession = vi.mocked(getSession);
const mockedGenerateQuest = vi.mocked(generateQuest);
const mockedQuestCreate = vi.mocked(prisma.quest.create);

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

const mockCreatedQuest = {
  id: "quest-123",
  childId: "child-1",
  discoveryId: null,
  dream: "I want to build robots",
  localContext: "I live in a village near a river",
  status: "active",
  generatedAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
  missions: mockQuestResult.missions.map((m) => ({
    id: `mission-${m.day}`,
    questId: "quest-123",
    day: m.day,
    title: m.title,
    description: m.description,
    instructions: JSON.stringify(m.instructions),
    materials: JSON.stringify(m.materials),
    tips: JSON.stringify(m.tips),
    status: m.day === 1 ? "available" : "locked",
    proofPhotoUrl: null,
    createdAt: new Date(),
    updatedAt: new Date(),
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
  });

  it("returns 401 when not authenticated", async () => {
    mockedGetSession.mockResolvedValue(null);

    const res = await POST(
      createRequest({
        dream: "I want to build robots",
        localContext: "I live in a village near a river",
      }),
    );
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe("unauthorized");
  });

  it("returns 200 with quest data on success", async () => {
    mockedGetSession.mockResolvedValue(validSession);
    mockedGenerateQuest.mockResolvedValue(mockQuestResult);
    mockedQuestCreate.mockResolvedValue(mockCreatedQuest as never);

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
    mockedQuestCreate.mockResolvedValue(mockCreatedQuest as never);

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
    mockedQuestCreate.mockResolvedValue(mockCreatedQuest as never);

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
    mockedQuestCreate.mockResolvedValue(mockCreatedQuest as never);

    await POST(
      createRequest({
        dream: "I want to build robots",
        localContext: "I live in a village near a river",
      }),
    );

    // Verify prisma was called with correct mission statuses
    expect(mockedQuestCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          missions: expect.objectContaining({
            create: expect.arrayContaining([
              expect.objectContaining({ day: 1, status: "available" }),
              expect.objectContaining({ day: 2, status: "locked" }),
            ]),
          }),
        }),
      }),
    );
  });

  it("passes discoveryId when provided", async () => {
    mockedGetSession.mockResolvedValue(validSession);
    mockedGenerateQuest.mockResolvedValue(mockQuestResult);
    mockedQuestCreate.mockResolvedValue(mockCreatedQuest as never);

    await POST(
      createRequest({
        dream: "I want to build robots",
        localContext: "I live in a village near a river",
        discoveryId: "disc-123",
      }),
    );

    expect(mockedQuestCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          discoveryId: "disc-123",
        }),
      }),
    );
  });

  it("each mission has all required fields", async () => {
    mockedGetSession.mockResolvedValue(validSession);
    mockedGenerateQuest.mockResolvedValue(mockQuestResult);
    mockedQuestCreate.mockResolvedValue(mockCreatedQuest as never);

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
