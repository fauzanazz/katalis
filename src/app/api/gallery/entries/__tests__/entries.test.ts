import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({
  getChildSession: vi.fn(),
}));

const mockTx = vi.hoisted(() => ({
  insert: vi.fn(),
  update: vi.fn(),
}));

const mockDb = vi.hoisted(() => ({
  query: {
    galleryEntries: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    quests: {
      findFirst: vi.fn(),
    },
  },
  select: vi.fn(() => ({
    from: vi.fn(() => ({
      where: vi.fn().mockResolvedValue([{ count: 0 }]),
    })),
  })),
  transaction: vi.fn(async (fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx)),
  update: vi.fn(() => ({
    set: vi.fn(() => ({
      where: vi.fn().mockResolvedValue(undefined),
    })),
  })),
}));

vi.mock("@/lib/db", () => ({ db: mockDb }));

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

vi.mock("@/lib/sanitize", () => ({
  sanitizeInput: vi.fn((v: string) => v),
}));

vi.mock("@/lib/url-allowlist", () => ({
  isAllowedStorageUrl: vi.fn().mockReturnValue(true),
}));

import { isAllowedStorageUrl } from "@/lib/url-allowlist";

vi.mock("@/lib/geocoding", () => ({
  geocodeLocationText: vi.fn().mockReturnValue({ country: "Indonesia" }),
}));

import { GET, POST } from "../route";
import { getChildSession } from "@/lib/auth";

const mockedGetSession = vi.mocked(getChildSession);

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

function setupSelectCount(total: number) {
  mockDb.select.mockReturnValue({
    from: vi.fn(() => ({
      where: vi.fn().mockResolvedValue([{ count: total }]),
    })),
  });
}

// ─── GET /api/gallery/entries ───

describe("GET /api/gallery/entries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 200 with empty entries array when no entries exist", async () => {
    mockDb.query.galleryEntries.findMany.mockResolvedValue([]);
    setupSelectCount(0);

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
    mockDb.query.galleryEntries.findMany.mockResolvedValue(entries);
    setupSelectCount(1);

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
    mockDb.query.galleryEntries.findMany.mockResolvedValue([]);
    setupSelectCount(50);

    const request = new Request(
      "http://localhost:3100/api/gallery/entries?page=2&pageSize=10",
    );
    const response = await GET(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.page).toBe(2);
    expect(data.pageSize).toBe(10);
    expect(data.total).toBe(50);

    // Verify Drizzle was called with correct offset/limit
    expect(mockDb.query.galleryEntries.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        offset: 10,
        limit: 10,
      }),
    );
  });

  it("does not require authentication for gallery browsing", async () => {
    mockDb.query.galleryEntries.findMany.mockResolvedValue([]);
    setupSelectCount(0);

    const request = new Request("http://localhost:3100/api/gallery/entries");
    const response = await GET(request);

    expect(response.status).toBe(200);
  });

  it("does not include childId in response entries (privacy)", async () => {
    const entries = [createGalleryEntry()];
    mockDb.query.galleryEntries.findMany.mockResolvedValue(entries);
    setupSelectCount(1);

    const request = new Request("http://localhost:3100/api/gallery/entries");
    const response = await GET(request);

    const data = await response.json();
    expect(data.entries[0]).not.toHaveProperty("childId");
  });

  it("returns entries with all required metadata fields", async () => {
    const entries = [createGalleryEntry()];
    mockDb.query.galleryEntries.findMany.mockResolvedValue(entries);
    setupSelectCount(1);

    const request = new Request("http://localhost:3100/api/gallery/entries");
    const response = await GET(request);

    const data = await response.json();
    const entry = data.entries[0];

    expect(entry).toHaveProperty("id");
    expect(entry).toHaveProperty("imageUrl");
    expect(entry).toHaveProperty("talentCategory");
    expect(entry).toHaveProperty("country");
    expect(entry).toHaveProperty("questContext");
    expect(entry).toHaveProperty("createdAt");
  });

  it("does not include coordinates in GET response entries (COPPA)", async () => {
    const entries = [createGalleryEntry()];
    mockDb.query.galleryEntries.findMany.mockResolvedValue(entries);
    setupSelectCount(1);

    const request = new Request("http://localhost:3100/api/gallery/entries");
    const response = await GET(request);

    const data = await response.json();
    expect(data.entries[0]).not.toHaveProperty("coordinates");
  });

  it("parses questContext JSON into object", async () => {
    const entries = [createGalleryEntry()];
    mockDb.query.galleryEntries.findMany.mockResolvedValue(entries);
    setupSelectCount(1);

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
    mockDb.query.galleryEntries.findMany.mockResolvedValue([]);
    setupSelectCount(0);

    const request = new Request(
      "http://localhost:3100/api/gallery/entries?talentCategory=Engineering",
    );
    const response = await GET(request);

    expect(response.status).toBe(200);
    // Drizzle passes a compiled expression — just verify the query ran
    expect(mockDb.query.galleryEntries.findMany).toHaveBeenCalled();
  });

  it("does not include coordinates in tag-filtered GET response entries (COPPA)", async () => {
    const entries = [
      createGalleryEntry({
        talentTags: JSON.stringify([{ name: "robotics", confidence: 0.9, category: "Engineering" }]),
      }),
    ];
    mockDb.query.galleryEntries.findMany.mockResolvedValue(entries);

    const request = new Request(
      "http://localhost:3100/api/gallery/entries?tag=robotics",
    );
    const response = await GET(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.entries[0]).not.toHaveProperty("coordinates");
  });

  it("clamps pageSize to max 100", async () => {
    mockDb.query.galleryEntries.findMany.mockResolvedValue([]);
    setupSelectCount(0);

    const request = new Request(
      "http://localhost:3100/api/gallery/entries?pageSize=500",
    );
    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(mockDb.query.galleryEntries.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        limit: 100,
      }),
    );
  });

  it("defaults to page 1 for invalid page parameter", async () => {
    mockDb.query.galleryEntries.findMany.mockResolvedValue([]);
    setupSelectCount(0);

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
    vi.mocked(isAllowedStorageUrl).mockReturnValue(true);
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
    mockDb.query.quests.findFirst.mockResolvedValue(null);

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
    mockDb.query.quests.findFirst.mockResolvedValue({
      id: "quest-1",
      childId: "child-other",
      status: "completed",
      missions: [],
      discovery: null,
    });

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
    mockDb.query.quests.findFirst.mockResolvedValue({
      id: "quest-1",
      childId: "child-1",
      status: "active",
      dream: "Build robots",
      localContext: "I live in Jakarta",
      missions,
      discovery: null,
    });

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
    mockDb.query.quests.findFirst.mockResolvedValue({
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
    });
    mockDb.query.galleryEntries.findFirst.mockResolvedValue({
      id: "existing-entry",
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
    mockDb.query.quests.findFirst.mockResolvedValue({
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
    });
    mockDb.query.galleryEntries.findFirst.mockResolvedValue(null);

    const galleryEntry = {
      id: "gallery-new",
      childId: "child-1",
      questId: "quest-1",
      imageUrl: "http://localhost:3100/api/storage/proof-3.jpg",
      talentCategory: "Engineering",
      country: "Indonesia",
      coordinates: null,
      questContext: JSON.stringify({
        questTitle: "I want to build robots",
        dream: "I want to build robots",
        missionSummaries: missions.map((m) => m.title),
      }),
      clusterGroup: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockTx.insert.mockReturnValue({
      values: vi.fn(() => ({
        returning: vi.fn().mockResolvedValue([galleryEntry]),
      })),
    });
    mockTx.update.mockReturnValue({
      set: vi.fn(() => ({
        where: vi.fn().mockResolvedValue(undefined),
      })),
    });
    mockDb.transaction.mockImplementation(async (fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx));

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

  it("does not include coordinates in POST response (COPPA)", async () => {
    const missions = Array.from({ length: 7 }, (_, i) => ({
      id: `m-${i}`,
      day: i + 1,
      status: "completed",
      proofPhotoUrl: `http://localhost:3100/api/storage/proof-${i}.jpg`,
      title: `Day ${i + 1} Mission`,
      description: `Description ${i + 1}`,
    }));

    mockedGetSession.mockResolvedValue(validSession);
    mockDb.query.quests.findFirst.mockResolvedValue({
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
    });
    mockDb.query.galleryEntries.findFirst.mockResolvedValue(null);

    const entryWithCoords = {
      id: "gallery-coppa",
      childId: "child-1",
      questId: "quest-1",
      imageUrl: "http://localhost:3100/api/storage/proof-0.jpg",
      talentCategory: "Engineering",
      country: "Indonesia",
      coordinates: null,
      questContext: JSON.stringify({ questTitle: "Build robots", dream: "Build robots", missionSummaries: [] }),
      clusterGroup: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockTx.insert.mockReturnValue({
      values: vi.fn(() => ({
        returning: vi.fn().mockResolvedValue([entryWithCoords]),
      })),
    });
    mockTx.update.mockReturnValue({
      set: vi.fn(() => ({
        where: vi.fn().mockResolvedValue(undefined),
      })),
    });
    mockDb.transaction.mockImplementation(async (fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx));

    const request = new Request("http://localhost:3100/api/gallery/entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questId: "quest-1" }),
    });
    const response = await POST(request);

    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.galleryEntry).not.toHaveProperty("coordinates");
  });

  it("returns 400 for invalid photo URL origin", async () => {
    vi.mocked(isAllowedStorageUrl).mockReturnValue(false);

    const missions = Array.from({ length: 7 }, (_, i) => ({
      id: `m-${i}`,
      day: i + 1,
      status: "completed",
      proofPhotoUrl: `http://localhost:3100/api/storage/proof-${i}.jpg`,
      title: `Day ${i + 1}`,
    }));

    mockedGetSession.mockResolvedValue(validSession);
    mockDb.query.quests.findFirst.mockResolvedValue({
      id: "quest-1",
      childId: "child-1",
      status: "completed",
      dream: "Build robots",
      localContext: "Jakarta",
      missions,
      discovery: null,
    });

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
    mockDb.query.quests.findFirst.mockResolvedValue({
      id: "quest-1",
      childId: "child-1",
      status: "completed",
      dream: "Build robots",
      localContext: "Jakarta",
      missions,
      discovery: null,
    });

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
    mockDb.query.quests.findFirst.mockResolvedValue({
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
    });
    mockDb.query.galleryEntries.findFirst.mockResolvedValue(null);

    const expectedEntry = {
      id: "gallery-auto",
      childId: "child-1",
      questId: "quest-1",
      imageUrl: "http://localhost:3100/api/storage/proof-0.jpg",
      talentCategory: "Engineering",
      country: "Indonesia",
      coordinates: null,
      questContext: JSON.stringify({
        questTitle: "Build robots",
        dream: "Build robots",
        missionSummaries: missions.map((m) => m.title),
      }),
      clusterGroup: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockTx.insert.mockReturnValue({
      values: vi.fn(() => ({
        returning: vi.fn().mockResolvedValue([expectedEntry]),
      })),
    });
    mockTx.update.mockReturnValue({
      set: vi.fn(() => ({
        where: vi.fn().mockResolvedValue(undefined),
      })),
    });
    mockDb.transaction.mockImplementation(async (fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx));

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
