import { describe, it, expect, vi, beforeEach } from "vitest";

const mockDb = vi.hoisted(() => ({
  query: {
    galleryEntries: {
      findFirst: vi.fn(),
    },
  },
}));

vi.mock("@/lib/db", () => ({ db: mockDb }));

import { GET } from "../route";

const mockedFindFirst = mockDb.query.galleryEntries.findFirst;

function createEntry(overrides?: Partial<Record<string, unknown>>) {
  return {
    id: "gallery-1",
    childId: "child-1",
    questId: "quest-1",
    imageUrl: "http://localhost:3100/api/storage/images/work-1.jpg",
    talentCategory: "Engineering",
    country: "Indonesia",
    coordinates: JSON.stringify({ lat: -6.21, lng: 106.85 }),
    questContext: JSON.stringify({
      questTitle: "Build Robots",
      dream: "I want to build robots",
      missionSummaries: ["Built a bridge", "Designed a robot"],
    }),
    clusterGroup: null,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    ...overrides,
  };
}

describe("GET /api/gallery/entries/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 200 with entry data for valid ID", async () => {
    mockedFindFirst.mockResolvedValue(createEntry());

    const request = new Request(
      "http://localhost:3100/api/gallery/entries/gallery-1",
    );
    const params = Promise.resolve({ id: "gallery-1" });
    const response = await GET(request, { params });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.id).toBe("gallery-1");
    expect(data.talentCategory).toBe("Engineering");
    expect(data.country).toBe("Indonesia");
    expect(data.coordinates).toEqual({ lat: -6.21, lng: 106.85 });
    expect(data.questContext).toEqual({
      questTitle: "Build Robots",
      dream: "I want to build robots",
      missionSummaries: ["Built a bridge", "Designed a robot"],
    });
  });

  it("returns 404 for non-existent entry", async () => {
    mockedFindFirst.mockResolvedValue(null);

    const request = new Request(
      "http://localhost:3100/api/gallery/entries/nonexistent",
    );
    const params = Promise.resolve({ id: "nonexistent" });
    const response = await GET(request, { params });

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBe("not_found");
  });

  it("does not include childId in response (privacy)", async () => {
    mockedFindFirst.mockResolvedValue(createEntry());

    const request = new Request(
      "http://localhost:3100/api/gallery/entries/gallery-1",
    );
    const params = Promise.resolve({ id: "gallery-1" });
    const response = await GET(request, { params });

    const data = await response.json();
    expect(data).not.toHaveProperty("childId");
  });

  it("does not require authentication (publicly accessible)", async () => {
    mockedFindFirst.mockResolvedValue(createEntry());

    const request = new Request(
      "http://localhost:3100/api/gallery/entries/gallery-1",
    );
    const params = Promise.resolve({ id: "gallery-1" });
    const response = await GET(request, { params });

    expect(response.status).toBe(200);
  });

  it("returns all required metadata fields", async () => {
    mockedFindFirst.mockResolvedValue(createEntry());

    const request = new Request(
      "http://localhost:3100/api/gallery/entries/gallery-1",
    );
    const params = Promise.resolve({ id: "gallery-1" });
    const response = await GET(request, { params });

    const data = await response.json();
    expect(data).toHaveProperty("id");
    expect(data).toHaveProperty("questId");
    expect(data).toHaveProperty("imageUrl");
    expect(data).toHaveProperty("talentCategory");
    expect(data).toHaveProperty("country");
    expect(data).toHaveProperty("coordinates");
    expect(data).toHaveProperty("questContext");
    expect(data).toHaveProperty("createdAt");
  });

  it("handles server errors gracefully", async () => {
    mockedFindFirst.mockRejectedValue(new Error("DB error"));

    const request = new Request(
      "http://localhost:3100/api/gallery/entries/gallery-1",
    );
    const params = Promise.resolve({ id: "gallery-1" });
    const response = await GET(request, { params });

    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error).toBe("server_error");
  });

  it("handles entries with null coordinates", async () => {
    mockedFindFirst.mockResolvedValue(
      createEntry({ coordinates: null }),
    );

    const request = new Request(
      "http://localhost:3100/api/gallery/entries/gallery-1",
    );
    const params = Promise.resolve({ id: "gallery-1" });
    const response = await GET(request, { params });

    const data = await response.json();
    expect(data.coordinates).toBeNull();
  });
});
