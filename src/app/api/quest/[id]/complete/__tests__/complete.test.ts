import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock auth
vi.mock("@/lib/auth", () => ({
  getChildSession: vi.fn(),
}));

const mockQuestUpdateWhere = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mockQuestUpdateSet = vi.hoisted(() => vi.fn(() => ({ where: mockQuestUpdateWhere })));

const mockDb = vi.hoisted(() => ({
  query: {
    quests: {
      findFirst: vi.fn(),
    },
    galleryEntries: {
      findFirst: vi.fn(),
    },
  },
  update: vi.fn(() => ({
    set: mockQuestUpdateSet,
  })),
  transaction: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ db: mockDb }));

vi.mock("@/lib/interests/quest-mapper", () => ({
  mapQuestToInterestSignals: vi.fn().mockReturnValue([
    { interestKey: "science", strength: 0.8, confidence: 0.8, dimension: "engagement" },
  ]),
}));

vi.mock("@/lib/interests/ingest-service", () => ({
  ingestInterestSignals: vi.fn().mockResolvedValue(undefined),
}));

import { POST } from "../../complete/route";
import { getChildSession } from "@/lib/auth";
import { ingestInterestSignals } from "@/lib/interests/ingest-service";

const mockedGetSession = vi.mocked(getChildSession);
const mockedIngestSignals = vi.mocked(ingestInterestSignals);

const validSession = {
  childId: "child-1",
  expiresAt: new Date().toISOString(),
};

function createCompletedMissions() {
  return Array.from({ length: 7 }, (_, i) => ({
    id: `mission-${i + 1}`,
    questId: "quest-1",
    day: i + 1,
    title: `Day ${i + 1} Mission`,
    description: `Description for day ${i + 1}`,
    instructions: JSON.stringify([`Step ${i + 1}`]),
    materials: JSON.stringify([`Material ${i + 1}`]),
    tips: JSON.stringify([`Tip ${i + 1}`]),
    status: "completed" as string,
    proofPhotoUrl: `http://localhost:3100/api/storage/proof-${i + 1}.jpg` as string | null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }));
}

function createQuest(overrides?: Partial<Record<string, unknown>>) {
  return {
    id: "quest-1",
    childId: "child-1",
    discoveryId: "discovery-1",
    dream: "I want to build robots",
    localContext: "I live in a village near a river",
    status: "completed",
    generatedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    missions: createCompletedMissions(),
    discovery: {
      id: "discovery-1",
      childId: "child-1",
      type: "artifact",
      fileUrl: "http://example.com/artifact.jpg",
      aiAnalysis: null,
      detectedTalents: JSON.stringify([
        { name: "Engineering", confidence: 0.92, reasoning: "Focus on mechanical details" },
      ]),
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    ...overrides,
  };
}

function makeRequest(body: unknown): Parameters<typeof POST>[0] {
  return new Request("http://localhost:3100/api/quest/quest-1/complete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as Parameters<typeof POST>[0];
}

function makeInvalidRequest(): Parameters<typeof POST>[0] {
  return new Request("http://localhost:3100/api/quest/quest-1/complete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "invalid json",
  }) as unknown as Parameters<typeof POST>[0];
}

describe("POST /api/quest/[id]/complete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockedGetSession.mockResolvedValue(null);

    const request = makeRequest({ selectedPhotoUrl: "http://example.com/photo.jpg" });
    const response = await POST(request, {
      params: Promise.resolve({ id: "quest-1" }),
    });

    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error).toBe("unauthorized");
  });

  it("returns 404 when quest not found", async () => {
    mockedGetSession.mockResolvedValue(validSession);
    mockDb.query.quests.findFirst.mockResolvedValue(null);

    const request = makeRequest({ selectedPhotoUrl: "http://example.com/photo.jpg" });
    const response = await POST(request, {
      params: Promise.resolve({ id: "nonexistent" }),
    });

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBe("not_found");
  });

  it("returns 403 when quest belongs to another child", async () => {
    mockedGetSession.mockResolvedValue(validSession);
    mockDb.query.quests.findFirst.mockResolvedValue(
      createQuest({ childId: "child-other" }),
    );

    const request = makeRequest({ selectedPhotoUrl: "http://example.com/photo.jpg" });
    const response = await POST(request, {
      params: Promise.resolve({ id: "quest-1" }),
    });

    expect(response.status).toBe(403);
    const data = await response.json();
    expect(data.error).toBe("forbidden");
  });

  it("returns 400 when quest is not completed (not all missions done)", async () => {
    const incompleteMissions = createCompletedMissions();
    incompleteMissions[6].status = "in_progress";
    incompleteMissions[6].proofPhotoUrl = null;

    mockedGetSession.mockResolvedValue(validSession);
    mockDb.query.quests.findFirst.mockResolvedValue(
      createQuest({
        status: "active",
        missions: incompleteMissions,
      }),
    );

    const request = makeRequest({ selectedPhotoUrl: "http://example.com/photo.jpg" });
    const response = await POST(request, {
      params: Promise.resolve({ id: "quest-1" }),
    });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe("incomplete_quest");
  });

  it("returns 200 with gallery entry when submitting best work (selectedPhotoUrl provided)", async () => {
    const quest = createQuest();
    mockedGetSession.mockResolvedValue(validSession);
    mockDb.query.quests.findFirst.mockResolvedValue(quest);
    mockDb.query.galleryEntries.findFirst.mockResolvedValue(null);

    const galleryEntry = {
      id: "gallery-1",
      childId: "child-1",
      questId: "quest-1",
      imageUrl: "http://localhost:3100/api/storage/proof-3.jpg",
      talentCategory: "Engineering",
      country: "village near a river",
      coordinates: null,
      questContext: null,
      clusterGroup: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockDb.transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
      const tx = {
        insert: vi.fn(() => ({
          values: vi.fn(() => ({
            returning: vi.fn().mockResolvedValue([galleryEntry]),
          })),
        })),
        update: vi.fn(() => ({
          set: vi.fn(() => ({
            where: vi.fn().mockResolvedValue(undefined),
          })),
        })),
      };
      return fn(tx);
    });

    const request = makeRequest({
      selectedPhotoUrl: "http://localhost:3100/api/storage/proof-3.jpg",
    });
    const response = await POST(request, {
      params: Promise.resolve({ id: "quest-1" }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.galleryEntry).toBeDefined();
    expect(data.galleryEntry.imageUrl).toBe(
      "http://localhost:3100/api/storage/proof-3.jpg",
    );
    expect(data.galleryEntry.talentCategory).toBe("Engineering");
  });

  it("returns 200 without gallery entry when skipping (skipGallery: true)", async () => {
    const quest = createQuest();
    mockedGetSession.mockResolvedValue(validSession);
    mockDb.query.quests.findFirst.mockResolvedValue(quest);
    mockDb.update.mockReturnValue({
      set: vi.fn(() => ({
        where: vi.fn().mockResolvedValue(undefined),
      })),
    });

    const request = makeRequest({ skipGallery: true });
    const response = await POST(request, {
      params: Promise.resolve({ id: "quest-1" }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.galleryEntry).toBeNull();
    expect(data.skipped).toBe(true);
  });

  it("skipGallery updates quest status to completed", async () => {
    const quest = createQuest({ status: "active" });
    mockedGetSession.mockResolvedValue(validSession);
    mockDb.query.quests.findFirst.mockResolvedValue(quest);

    const updateWhereFn = vi.fn().mockResolvedValue(undefined);
    const updateSetFn = vi.fn(() => ({ where: updateWhereFn }));
    mockDb.update.mockReturnValue({ set: updateSetFn });

    await POST(makeRequest({ skipGallery: true }), {
      params: Promise.resolve({ id: "quest-1" }),
    });

    expect(updateSetFn).toHaveBeenCalledWith({ status: "completed" });
  });

  it("skipGallery runs quest_completed interest ingestion", async () => {
    const quest = createQuest();
    mockedGetSession.mockResolvedValue(validSession);
    mockDb.query.quests.findFirst.mockResolvedValue(quest);
    mockDb.update.mockReturnValue({
      set: vi.fn(() => ({
        where: vi.fn().mockResolvedValue(undefined),
      })),
    });

    await POST(makeRequest({ skipGallery: true }), {
      params: Promise.resolve({ id: "quest-1" }),
    });

    expect(mockedIngestSignals).toHaveBeenCalledWith(
      expect.objectContaining({
        childId: "child-1",
        source: "quest_completed",
        questId: "quest-1",
      }),
    );
  });

  it("returns 400 when selectedPhotoUrl is not from quest missions", async () => {
    const quest = createQuest();
    mockedGetSession.mockResolvedValue(validSession);
    mockDb.query.quests.findFirst.mockResolvedValue(quest);

    const request = makeRequest({
      selectedPhotoUrl: "http://localhost:3100/api/storage/unknown-photo.jpg",
    });
    const response = await POST(request, {
      params: Promise.resolve({ id: "quest-1" }),
    });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe("invalid_photo");
  });

  it("returns 400 when selectedPhotoUrl is from untrusted origin", async () => {
    const quest = createQuest();
    mockedGetSession.mockResolvedValue(validSession);
    mockDb.query.quests.findFirst.mockResolvedValue(quest);

    const request = makeRequest({
      selectedPhotoUrl: "http://evil.com/malicious-photo.jpg",
    });
    const response = await POST(request, {
      params: Promise.resolve({ id: "quest-1" }),
    });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe("invalid");
  });

  it("returns 409 when gallery entry already exists for this quest", async () => {
    const quest = createQuest();
    mockedGetSession.mockResolvedValue(validSession);
    mockDb.query.quests.findFirst.mockResolvedValue(quest);
    mockDb.query.galleryEntries.findFirst.mockResolvedValue({
      id: "existing-gallery",
    });

    const request = makeRequest({
      selectedPhotoUrl: "http://localhost:3100/api/storage/proof-1.jpg",
    });
    const response = await POST(request, {
      params: Promise.resolve({ id: "quest-1" }),
    });

    expect(response.status).toBe(409);
    const data = await response.json();
    expect(data.error).toBe("duplicate_entry");
  });

  it("returns 400 for invalid request body", async () => {
    mockedGetSession.mockResolvedValue(validSession);
    mockDb.query.quests.findFirst.mockResolvedValue(createQuest());

    const response = await POST(makeInvalidRequest(), {
      params: Promise.resolve({ id: "quest-1" }),
    });

    expect(response.status).toBe(400);
  });

  it("extracts talent category from discovery talents", async () => {
    const quest = createQuest({
      discovery: {
        id: "discovery-1",
        childId: "child-1",
        type: "artifact",
        fileUrl: null,
        aiAnalysis: null,
        detectedTalents: JSON.stringify([
          { name: "Storytelling", confidence: 0.95, reasoning: "Vivid narrative" },
          { name: "Creativity", confidence: 0.8, reasoning: "Imaginative" },
        ]),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    mockedGetSession.mockResolvedValue(validSession);
    mockDb.query.quests.findFirst.mockResolvedValue(quest);
    mockDb.query.galleryEntries.findFirst.mockResolvedValue(null);

    const galleryEntry = {
      id: "gallery-1",
      childId: "child-1",
      questId: "quest-1",
      imageUrl: "http://localhost:3100/api/storage/proof-1.jpg",
      talentCategory: "Storytelling",
      country: "village near a river",
      coordinates: null,
      questContext: null,
      clusterGroup: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockDb.transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
      const tx = {
        insert: vi.fn(() => ({
          values: vi.fn(() => ({
            returning: vi.fn().mockResolvedValue([galleryEntry]),
          })),
        })),
        update: vi.fn(() => ({
          set: vi.fn(() => ({
            where: vi.fn().mockResolvedValue(undefined),
          })),
        })),
      };
      return fn(tx);
    });

    const request = makeRequest({
      selectedPhotoUrl: "http://localhost:3100/api/storage/proof-1.jpg",
    });
    const response = await POST(request, {
      params: Promise.resolve({ id: "quest-1" }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.galleryEntry.talentCategory).toBe("Storytelling");
  });
});
