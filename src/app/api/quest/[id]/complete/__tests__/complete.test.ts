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
    galleryEntry: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

import { POST } from "../../complete/route";
import { getChildSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

const mockedGetSession = vi.mocked(getChildSession);
const mockedQuestFindUnique = vi.mocked(prisma.quest.findUnique);
const mockedTransaction = vi.mocked(prisma.$transaction);
const mockedGalleryEntryFindUnique = vi.mocked(
  prisma.galleryEntry.findUnique,
);

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
    mockedQuestFindUnique.mockResolvedValue(null);

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
    mockedQuestFindUnique.mockResolvedValue(
      createQuest({ childId: "child-other" }) as never,
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
    mockedQuestFindUnique.mockResolvedValue(
      createQuest({
        status: "active",
        missions: incompleteMissions,
      }) as never,
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
    mockedQuestFindUnique.mockResolvedValue(quest as never);
    mockedGalleryEntryFindUnique.mockResolvedValue(null);

    const galleryEntry = {
      id: "gallery-1",
      childId: "child-1",
      questId: "quest-1",
      imageUrl: "http://localhost:3100/api/storage/proof-3.jpg",
      talentCategory: "Engineering",
      country: "village near a river",
      coordinates: null,
      clusterGroup: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockedTransaction.mockImplementation(async (fn: unknown) => {
      if (typeof fn === "function") {
        return fn({
          galleryEntry: { create: vi.fn().mockResolvedValue(galleryEntry) },
          quest: { update: vi.fn() },
        });
      }
      return galleryEntry;
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
    mockedQuestFindUnique.mockResolvedValue(quest as never);

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

  it("returns 400 when selectedPhotoUrl is not from quest missions", async () => {
    const quest = createQuest();
    mockedGetSession.mockResolvedValue(validSession);
    mockedQuestFindUnique.mockResolvedValue(quest as never);

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
    mockedQuestFindUnique.mockResolvedValue(quest as never);

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
    mockedQuestFindUnique.mockResolvedValue(quest as never);
    mockedGalleryEntryFindUnique.mockResolvedValue({
      id: "existing-gallery",
    } as never);

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
    mockedQuestFindUnique.mockResolvedValue(createQuest() as never);

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
    mockedQuestFindUnique.mockResolvedValue(quest as never);
    mockedGalleryEntryFindUnique.mockResolvedValue(null);

    const galleryEntry = {
      id: "gallery-1",
      childId: "child-1",
      questId: "quest-1",
      imageUrl: "http://localhost:3100/api/storage/proof-1.jpg",
      talentCategory: "Storytelling",
      country: "village near a river",
      coordinates: null,
      clusterGroup: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockedTransaction.mockImplementation(async (fn: unknown) => {
      if (typeof fn === "function") {
        return fn({
          galleryEntry: { create: vi.fn().mockResolvedValue(galleryEntry) },
          quest: { update: vi.fn() },
        });
      }
      return galleryEntry;
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
