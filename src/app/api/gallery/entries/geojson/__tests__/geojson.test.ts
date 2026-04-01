import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    galleryEntry: {
      findMany: vi.fn(),
    },
  },
}));

import { GET } from "../route";
import { prisma } from "@/lib/db";

const mockedFindMany = vi.mocked(prisma.galleryEntry.findMany);

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

describe("GET /api/gallery/entries/geojson", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns GeoJSON FeatureCollection with empty features when no entries", async () => {
    mockedFindMany.mockResolvedValue([]);

    const request = new Request(
      "http://localhost:3100/api/gallery/entries/geojson",
    );
    const response = await GET(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.type).toBe("FeatureCollection");
    expect(data.features).toEqual([]);
  });

  it("returns entries as GeoJSON features with correct structure", async () => {
    mockedFindMany.mockResolvedValue([createEntry()] as never);

    const request = new Request(
      "http://localhost:3100/api/gallery/entries/geojson",
    );
    const response = await GET(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.type).toBe("FeatureCollection");
    expect(data.features).toHaveLength(1);

    const feature = data.features[0];
    expect(feature.type).toBe("Feature");
    expect(feature.geometry.type).toBe("Point");
    // GeoJSON uses [lng, lat] order
    expect(feature.geometry.coordinates).toEqual([106.85, -6.21]);
    expect(feature.properties.id).toBe("gallery-1");
    expect(feature.properties.talentCategory).toBe("Engineering");
    expect(feature.properties.country).toBe("Indonesia");
    expect(feature.properties.imageUrl).toBeTruthy();
  });

  it("filters out entries with null coordinates", async () => {
    mockedFindMany.mockResolvedValue([
      createEntry({ coordinates: null }),
    ] as never);

    const request = new Request(
      "http://localhost:3100/api/gallery/entries/geojson",
    );
    const response = await GET(request);

    const data = await response.json();
    // The entry has null coordinates so it should be filtered (but at DB level)
    // since we filter with `coordinates: { not: null }` in the query
    expect(data.features.length).toBe(0);
  });

  it("filters entries with invalid JSON coordinates", async () => {
    mockedFindMany.mockResolvedValue([
      createEntry({ coordinates: "invalid-json" }),
    ] as never);

    const request = new Request(
      "http://localhost:3100/api/gallery/entries/geojson",
    );
    const response = await GET(request);

    const data = await response.json();
    expect(data.features).toHaveLength(0);
  });

  it("supports talentCategory filter", async () => {
    mockedFindMany.mockResolvedValue([]);

    const request = new Request(
      "http://localhost:3100/api/gallery/entries/geojson?talentCategory=Art",
    );
    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(mockedFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          talentCategory: "Art",
        }),
      }),
    );
  });

  it("does not require authentication (publicly accessible)", async () => {
    mockedFindMany.mockResolvedValue([]);

    const request = new Request(
      "http://localhost:3100/api/gallery/entries/geojson",
    );
    const response = await GET(request);

    expect(response.status).toBe(200);
  });

  it("does not include childId in feature properties (privacy)", async () => {
    mockedFindMany.mockResolvedValue([createEntry()] as never);

    const request = new Request(
      "http://localhost:3100/api/gallery/entries/geojson",
    );
    const response = await GET(request);

    const data = await response.json();
    expect(data.features[0].properties).not.toHaveProperty("childId");
  });

  it("handles multiple entries from different countries", async () => {
    mockedFindMany.mockResolvedValue([
      createEntry({
        id: "g-1",
        talentCategory: "Engineering",
        country: "Indonesia",
        coordinates: JSON.stringify({ lat: -6.21, lng: 106.85 }),
      }),
      createEntry({
        id: "g-2",
        talentCategory: "Art",
        country: "Japan",
        coordinates: JSON.stringify({ lat: 36.2, lng: 138.3 }),
      }),
      createEntry({
        id: "g-3",
        talentCategory: "Narrative",
        country: "Brazil",
        coordinates: JSON.stringify({ lat: -14.2, lng: -51.9 }),
      }),
    ] as never);

    const request = new Request(
      "http://localhost:3100/api/gallery/entries/geojson",
    );
    const response = await GET(request);

    const data = await response.json();
    expect(data.features).toHaveLength(3);
    expect(data.features[0].properties.country).toBe("Indonesia");
    expect(data.features[1].properties.country).toBe("Japan");
    expect(data.features[2].properties.country).toBe("Brazil");
  });

  it("handles server errors gracefully", async () => {
    mockedFindMany.mockRejectedValue(new Error("DB connection failed"));

    const request = new Request(
      "http://localhost:3100/api/gallery/entries/geojson",
    );
    const response = await GET(request);

    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error).toBe("server_error");
  });
});
