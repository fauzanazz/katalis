import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock auth
vi.mock("@/lib/auth", () => ({
  getChildSession: vi.fn(),
}));

// Mock Prisma
vi.mock("@/lib/db", () => ({
  prisma: {
    galleryEntry: {
      findMany: vi.fn(),
      count: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    quest: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/moderation", () => ({
  moderateImageContent: vi.fn().mockResolvedValue({
    allowed: true,
    status: "approved",
    confidence: 0.97,
    reasoning: "Image appears safe",
    eventId: "mod-1",
  }),
}));

vi.mock("@/lib/ai/tag-classifier", () => ({
  classifyTags: vi.fn().mockResolvedValue({ tags: [] }),
}));

import { GET, POST } from "../route";
import { getChildSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

const mockedGetSession = vi.mocked(getChildSession);
const mockedGalleryFindMany = vi.mocked(prisma.galleryEntry.findMany);
const mockedGalleryCount = vi.mocked(prisma.galleryEntry.count);
const mockedGalleryFindUnique = vi.mocked(prisma.galleryEntry.findUnique);
const mockedTransaction = vi.mocked(prisma.$transaction);
const mockedQuestFindUnique = vi.mocked(prisma.quest.findUnique);

const validSession = {
  childId: "child-1",
  expiresAt: new Date().toISOString(),
};

function createGalleryEntry(overrides?: Partial<Record<string, unknown>>) {
  return {
    id: "gallery-1",
    childId: "child-1",
    questId: "quest-1",
    imageUrl: "http://localhost:3100/api/storage/images/work-1.jpg",
    talentCategory: "Engineering",
    country: "Indonesia",
    coordinates: JSON.stringify({ lat: -6.21, lng: 106.85 }),
    questContext: JSON.stringify({
      questTitle: "7-Day Engineering Quest",
      dream: "I want to build robots",
      missionSummaries: ["Built a paper bridge", "Designed a robot arm"],
    }),
    clusterGroup: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// ─── GET /api/gallery/entries ───

describe("GET /api/gallery/entries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 200 with empty entries array when no entries exist", async () => {
    mockedGalleryFindMany.mockResolvedValue([]);
    mockedGalleryCount.mockResolvedValue(0);

    const request = new Request("http://localhost:3100/api/gallery/entries");
    const response = await GET(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.entries).toEqual([]);
    expect(data.total).toBe(0);
    expect(data.page).toBe(1);
    expect(data.pageSize).toBe(20);
  });

  it("returns 200 with paginated entries", async () => {
    const entries = [createGalleryEntry()];
    mockedGalleryFindMany.mockResolvedValue(entries as never);
    mockedGalleryCount.mockResolvedValue(1);

    const request = new Request("http://localhost:3100/api/gallery/entries");
    const response = await GET(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.entries).toHaveLength(1);
    expect(data.entries[0].id).toBe("gallery-1");
    expect(data.entries[0].talentCategory).toBe("Engineering");
    expect(data.entries[0].country).toBe("Indonesia");
    expect(data.total).toBe(1);
  });

  it("supports page and pageSize query parameters", async () => {
    mockedGalleryFindMany.mockResolvedValue([]);
    mockedGalleryCount.mockResolvedValue(50);

    const request = new Request(
      "http://localhost:3100/api/gallery/entries?page=2&pageSize=10",
    );
    const response = await GET(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.page).toBe(2);
    expect(data.pageSize).toBe(10);
    expect(data.total).toBe(50);

    // Verify Prisma was called with correct skip/take
    expect(mockedGalleryFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 10,
        take: 10,
      }),
    );
  });

  it("does not require authentication for gallery browsing", async () => {
    // No session set — should still work
    mockedGalleryFindMany.mockResolvedValue([]);
    mockedGalleryCount.mockResolvedValue(0);

    const request = new Request("http://localhost:3100/api/gallery/entries");
    const response = await GET(request);

    expect(response.status).toBe(200);
  });

  it("does not include childId in response entries (privacy)", async () => {
    const entries = [createGalleryEntry()];
    mockedGalleryFindMany.mockResolvedValue(entries as never);
    mockedGalleryCount.mockResolvedValue(1);

    const request = new Request("http://localhost:3100/api/gallery/entries");
    const response = await GET(request);

    const data = await response.json();
    expect(data.entries[0]).not.toHaveProperty("childId");
  });

  it("returns entries with all required metadata fields", async () => {
    const entries = [createGalleryEntry()];
    mockedGalleryFindMany.mockResolvedValue(entries as never);
    mockedGalleryCount.mockResolvedValue(1);

    const request = new Request("http://localhost:3100/api/gallery/entries");
    const response = await GET(request);

    const data = await response.json();
    const entry = data.entries[0];

    // All required fields must be present
    expect(entry).toHaveProperty("id");
    expect(entry).toHaveProperty("imageUrl");
    expect(entry).toHaveProperty("talentCategory");
    expect(entry).toHaveProperty("country");
    expect(entry).toHaveProperty("coordinates");
    expect(entry).toHaveProperty("questContext");
    expect(entry).toHaveProperty("createdAt");
  });

  it("parses coordinates JSON into object", async () => {
    const entries = [createGalleryEntry()];
    mockedGalleryFindMany.mockResolvedValue(entries as never);
    mockedGalleryCount.mockResolvedValue(1);

    const request = new Request("http://localhost:3100/api/gallery/entries");
    const response = await GET(request);

    const data = await response.json();
    expect(data.entries[0].coordinates).toEqual({ lat: -6.21, lng: 106.85 });
  });

  it("parses questContext JSON into object", async () => {
    const entries = [createGalleryEntry()];
    mockedGalleryFindMany.mockResolvedValue(entries as never);
    mockedGalleryCount.mockResolvedValue(1);

    const request = new Request("http://localhost:3100/api/gallery/entries");
    const response = await GET(request);

    const data = await response.json();
    expect(data.entries[0].questContext).toEqual({
      questTitle: "7-Day Engineering Quest",
      dream: "I want to build robots",
      missionSummaries: ["Built a paper bridge", "Designed a robot arm"],
    });
  });

  it("supports talentCategory filter", async () => {
    mockedGalleryFindMany.mockResolvedValue([]);
    mockedGalleryCount.mockResolvedValue(0);

    const request = new Request(
      "http://localhost:3100/api/gallery/entries?talentCategory=Engineering",
    );
    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(mockedGalleryFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          talentCategory: "Engineering",
        }),
      }),
    );
  });

  it("clamps pageSize to max 100", async () => {
    mockedGalleryFindMany.mockResolvedValue([]);
    mockedGalleryCount.mockResolvedValue(0);

    const request = new Request(
      "http://localhost:3100/api/gallery/entries?pageSize=500",
    );
    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(mockedGalleryFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 100,
      }),
    );
  });

  it("defaults to page 1 for invalid page parameter", async () => {
    mockedGalleryFindMany.mockResolvedValue([]);
    mockedGalleryCount.mockResolvedValue(0);

    const request = new Request(
      "http://localhost:3100/api/gallery/entries?page=-1",
    );
    const response = await GET(request);

    const data = await response.json();
    expect(data.page).toBe(1);
  });
});

// ─── POST /api/gallery/entries ───

describe("POST /api/gallery/entries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockedGetSession.mockResolvedValue(null);

    const request = new Request("http://localhost:3100/api/gallery/entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questId: "quest-1" }),
    });
    const response = await POST(request);

    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error).toBe("unauthorized");
  });

  it("returns 400 when questId is missing", async () => {
    mockedGetSession.mockResolvedValue(validSession);

    const request = new Request("http://localhost:3100/api/gallery/entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const response = await POST(request);

    expect(response.status).toBe(400);
  });

  it("returns 404 when quest not found", async () => {
    mockedGetSession.mockResolvedValue(validSession);
    mockedQuestFindUnique.mockResolvedValue(null);

    const request = new Request("http://localhost:3100/api/gallery/entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questId: "nonexistent" }),
    });
    const response = await POST(request);

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBe("not_found");
  });

  it("returns 403 when quest belongs to another child", async () => {
    mockedGetSession.mockResolvedValue(validSession);
    mockedQuestFindUnique.mockResolvedValue({
      id: "quest-1",
      childId: "child-other",
      status: "completed",
      missions: [],
      discovery: null,
    } as never);

    const request = new Request("http://localhost:3100/api/gallery/entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questId: "quest-1" }),
    });
    const response = await POST(request);

    expect(response.status).toBe(403);
  });

  it("returns 400 when quest missions are not all completed", async () => {
    const missions = Array.from({ length: 7 }, (_, i) => ({
      id: `m-${i}`,
      day: i + 1,
      status: i < 5 ? "completed" : "locked",
      proofPhotoUrl: i < 5 ? `http://localhost:3100/api/storage/proof-${i}.jpg` : null,
      title: `Day ${i + 1}`,
    }));

    mockedGetSession.mockResolvedValue(validSession);
    mockedQuestFindUnique.mockResolvedValue({
      id: "quest-1",
      childId: "child-1",
      status: "active",
      dream: "Build robots",
      localContext: "I live in Jakarta",
      missions,
      discovery: null,
    } as never);

    const request = new Request("http://localhost:3100/api/gallery/entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questId: "quest-1" }),
    });
    const response = await POST(request);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe("incomplete_quest");
  });

  it("returns 409 when gallery entry already exists for this quest", async () => {
    const missions = Array.from({ length: 7 }, (_, i) => ({
      id: `m-${i}`,
      day: i + 1,
      status: "completed",
      proofPhotoUrl: `http://localhost:3100/api/storage/proof-${i}.jpg`,
      title: `Day ${i + 1}`,
    }));

    mockedGetSession.mockResolvedValue(validSession);
    mockedQuestFindUnique.mockResolvedValue({
      id: "quest-1",
      childId: "child-1",
      status: "completed",
      dream: "Build robots",
      localContext: "I live in Jakarta",
      missions,
      discovery: {
        detectedTalents: JSON.stringify([
          { name: "Engineering", confidence: 0.9 },
        ]),
      },
    } as never);
    mockedGalleryFindUnique.mockResolvedValue({
      id: "existing-entry",
    } as never);

    const request = new Request("http://localhost:3100/api/gallery/entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        questId: "quest-1",
        selectedPhotoUrl: "http://localhost:3100/api/storage/proof-3.jpg",
      }),
    });
    const response = await POST(request);

    expect(response.status).toBe(409);
    const data = await response.json();
    expect(data.error).toBe("duplicate_entry");
  });

  it("returns 201 with gallery entry when valid (auto-geocoding)", async () => {
    const missions = Array.from({ length: 7 }, (_, i) => ({
      id: `m-${i}`,
      day: i + 1,
      status: "completed",
      proofPhotoUrl: `http://localhost:3100/api/storage/proof-${i}.jpg`,
      title: `Day ${i + 1} Mission`,
      description: `Do something on day ${i + 1}`,
    }));

    mockedGetSession.mockResolvedValue(validSession);
    mockedQuestFindUnique.mockResolvedValue({
      id: "quest-1",
      childId: "child-1",
      status: "completed",
      dream: "I want to build robots",
      localContext: "I live in Jakarta near a river",
      missions,
      discovery: {
        detectedTalents: JSON.stringify([
          { name: "Engineering", confidence: 0.95 },
          { name: "Creativity", confidence: 0.8 },
        ]),
      },
    } as never);
    mockedGalleryFindUnique.mockResolvedValue(null);

    const galleryEntry = {
      id: "gallery-new",
      childId: "child-1",
      questId: "quest-1",
      imageUrl: "http://localhost:3100/api/storage/proof-3.jpg",
      talentCategory: "Engineering",
      country: "Indonesia",
      coordinates: JSON.stringify({ lat: -6.21, lng: 106.85 }),
      questContext: JSON.stringify({
        questTitle: "I want to build robots",
        dream: "I want to build robots",
        missionSummaries: missions.map((m) => m.title),
      }),
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

    const request = new Request("http://localhost:3100/api/gallery/entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        questId: "quest-1",
        selectedPhotoUrl: "http://localhost:3100/api/storage/proof-3.jpg",
      }),
    });
    const response = await POST(request);

    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.galleryEntry).toBeDefined();
    expect(data.galleryEntry.talentCategory).toBe("Engineering");
    expect(data.galleryEntry.country).toBe("Indonesia");
    // Should not include childId in response (privacy)
    expect(data.galleryEntry).not.toHaveProperty("childId");
  });

  it("returns 400 for invalid photo URL origin", async () => {
    const missions = Array.from({ length: 7 }, (_, i) => ({
      id: `m-${i}`,
      day: i + 1,
      status: "completed",
      proofPhotoUrl: `http://localhost:3100/api/storage/proof-${i}.jpg`,
      title: `Day ${i + 1}`,
    }));

    mockedGetSession.mockResolvedValue(validSession);
    mockedQuestFindUnique.mockResolvedValue({
      id: "quest-1",
      childId: "child-1",
      status: "completed",
      dream: "Build robots",
      localContext: "Jakarta",
      missions,
      discovery: null,
    } as never);

    const request = new Request("http://localhost:3100/api/gallery/entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        questId: "quest-1",
        selectedPhotoUrl: "http://evil.com/malicious.jpg",
      }),
    });
    const response = await POST(request);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe("invalid");
  });

  it("validates selectedPhotoUrl is from quest missions", async () => {
    const missions = Array.from({ length: 7 }, (_, i) => ({
      id: `m-${i}`,
      day: i + 1,
      status: "completed",
      proofPhotoUrl: `http://localhost:3100/api/storage/proof-${i}.jpg`,
      title: `Day ${i + 1}`,
    }));

    mockedGetSession.mockResolvedValue(validSession);
    mockedQuestFindUnique.mockResolvedValue({
      id: "quest-1",
      childId: "child-1",
      status: "completed",
      dream: "Build robots",
      localContext: "Jakarta",
      missions,
      discovery: null,
    } as never);

    const request = new Request("http://localhost:3100/api/gallery/entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        questId: "quest-1",
        selectedPhotoUrl: "http://localhost:3100/api/storage/not-a-mission-photo.jpg",
      }),
    });
    const response = await POST(request);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe("invalid_photo");
  });

  it("returns 400 for invalid request body", async () => {
    mockedGetSession.mockResolvedValue(validSession);

    const request = new Request("http://localhost:3100/api/gallery/entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "invalid json",
    });
    const response = await POST(request);

    expect(response.status).toBe(400);
  });

  it("uses first mission proof photo if no selectedPhotoUrl provided", async () => {
    const missions = Array.from({ length: 7 }, (_, i) => ({
      id: `m-${i}`,
      day: i + 1,
      status: "completed",
      proofPhotoUrl: `http://localhost:3100/api/storage/proof-${i}.jpg`,
      title: `Day ${i + 1} Mission`,
      description: `Description ${i + 1}`,
    }));

    mockedGetSession.mockResolvedValue(validSession);
    mockedQuestFindUnique.mockResolvedValue({
      id: "quest-1",
      childId: "child-1",
      status: "completed",
      dream: "Build robots",
      localContext: "I live in Jakarta",
      missions,
      discovery: {
        detectedTalents: JSON.stringify([
          { name: "Engineering", confidence: 0.9 },
        ]),
      },
    } as never);
    mockedGalleryFindUnique.mockResolvedValue(null);

    const expectedEntry = {
      id: "gallery-auto",
      childId: "child-1",
      questId: "quest-1",
      imageUrl: "http://localhost:3100/api/storage/proof-0.jpg",
      talentCategory: "Engineering",
      country: "Indonesia",
      coordinates: JSON.stringify({ lat: -6.21, lng: 106.85 }),
      questContext: JSON.stringify({
        questTitle: "Build robots",
        dream: "Build robots",
        missionSummaries: missions.map((m) => m.title),
      }),
      clusterGroup: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockedTransaction.mockImplementation(async (fn: unknown) => {
      if (typeof fn === "function") {
        return fn({
          galleryEntry: { create: vi.fn().mockResolvedValue(expectedEntry) },
          quest: { update: vi.fn() },
        });
      }
      return expectedEntry;
    });

    const request = new Request("http://localhost:3100/api/gallery/entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questId: "quest-1" }),
    });
    const response = await POST(request);

    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.galleryEntry.imageUrl).toBe(
      "http://localhost:3100/api/storage/proof-0.jpg",
    );
  });
});
