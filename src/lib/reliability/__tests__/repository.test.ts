import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    discoveryRating: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    discovery: {
      findFirst: vi.fn(),
    },
    reliabilitySnapshot: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    reliabilityAlert: {
      create: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    $queryRawUnsafe: vi.fn(),
  },
}));

import { prisma } from "@/lib/db";
import {
  acknowledgeAlert,
  createDiscoveryRating,
  createReliabilityAlert,
  createReliabilitySnapshot,
  findNextUnratedDiscoveryForUser,
  listRatedItems,
  listRecentSnapshots,
  listUnacknowledgedAlerts,
} from "@/lib/reliability/repository";

interface MockPrismaShape {
  discoveryRating: {
    create: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
  };
  discovery: { findFirst: ReturnType<typeof vi.fn> };
  reliabilitySnapshot: {
    create: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
  };
  reliabilityAlert: {
    create: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  $queryRawUnsafe: ReturnType<typeof vi.fn>;
}

const mockPrisma = prisma as unknown as MockPrismaShape;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("reliability repository — createDiscoveryRating", () => {
  it("serializes label arrays to JSON and persists with rater id", async () => {
    mockPrisma.discoveryRating.create.mockResolvedValue({ id: "rating-1" });

    await createDiscoveryRating({
      discoveryId: "discovery-1",
      raterUserId: "user-admin",
      humanInterestKeys: ["nature", "art"],
      humanTagCategories: ["Art", "Creative"],
      aiInterestKeysAtRate: ["nature"],
      aiTagCategoriesAtRate: ["Art"],
      notes: "looked confident",
    });

    expect(mockPrisma.discoveryRating.create).toHaveBeenCalledWith({
      data: {
        discoveryId: "discovery-1",
        raterUserId: "user-admin",
        humanInterestKeys: JSON.stringify(["nature", "art"]),
        humanTagCategories: JSON.stringify(["Art", "Creative"]),
        aiInterestKeysAtRate: JSON.stringify(["nature"]),
        aiTagCategoriesAtRate: JSON.stringify(["Art"]),
        notes: "looked confident",
      },
    });
  });
});

describe("reliability repository — listRatedItems", () => {
  it("parses interest-keys layer into RatingPair sets", async () => {
    mockPrisma.discoveryRating.findMany.mockResolvedValue([
      {
        id: "r-1",
        humanInterestKeys: JSON.stringify(["nature", "art"]),
        aiInterestKeysAtRate: JSON.stringify(["nature"]),
        humanTagCategories: JSON.stringify(["Art"]),
        aiTagCategoriesAtRate: JSON.stringify(["Art"]),
      },
    ]);

    const items = await listRatedItems("interest_keys");
    expect(items).toHaveLength(1);
    expect([...items[0].aiLabels]).toEqual(["nature"]);
    expect([...items[0].humanLabels].sort()).toEqual(["art", "nature"]);
  });

  it("parses tag-categories layer into RatingPair sets", async () => {
    mockPrisma.discoveryRating.findMany.mockResolvedValue([
      {
        id: "r-1",
        humanInterestKeys: JSON.stringify([]),
        aiInterestKeysAtRate: JSON.stringify([]),
        humanTagCategories: JSON.stringify(["Art", "Creative"]),
        aiTagCategoriesAtRate: JSON.stringify(["Art"]),
      },
    ]);

    const items = await listRatedItems("tag_categories");
    expect([...items[0].aiLabels]).toEqual(["Art"]);
    expect([...items[0].humanLabels].sort()).toEqual(["Art", "Creative"]);
  });
});

describe("reliability repository — findNextUnratedDiscoveryForUser", () => {
  it("returns a discovery the user has not rated yet (random sample)", async () => {
    mockPrisma.discovery.findFirst.mockResolvedValue({
      id: "discovery-7",
      detectedTalents: null,
    });

    const result = await findNextUnratedDiscoveryForUser("user-admin");
    expect(result?.id).toBe("discovery-7");
    expect(mockPrisma.discovery.findFirst).toHaveBeenCalledTimes(1);
  });

  it("returns null when no unrated discoveries remain", async () => {
    mockPrisma.discovery.findFirst.mockResolvedValue(null);
    const result = await findNextUnratedDiscoveryForUser("user-admin");
    expect(result).toBeNull();
  });
});

describe("reliability repository — snapshots + alerts", () => {
  it("stores snapshot payload as JSON", async () => {
    mockPrisma.reliabilitySnapshot.create.mockResolvedValue({ id: "snap-1" });

    await createReliabilitySnapshot({
      layer: "interest_keys",
      kappa: 0.72,
      sampleSize: 52,
      payload: { perLabel: [], topConfused: [] },
      triggeredBy: "cron",
    });

    expect(mockPrisma.reliabilitySnapshot.create).toHaveBeenCalledWith({
      data: {
        layer: "interest_keys",
        kappa: 0.72,
        sampleSize: 52,
        payloadJson: JSON.stringify({ perLabel: [], topConfused: [] }),
        triggeredBy: "cron",
      },
    });
  });

  it("lists recent snapshots ordered by computedAt desc", async () => {
    mockPrisma.reliabilitySnapshot.findMany.mockResolvedValue([]);
    await listRecentSnapshots("tag_categories", 10);
    expect(mockPrisma.reliabilitySnapshot.findMany).toHaveBeenCalledWith({
      where: { layer: "tag_categories" },
      orderBy: { computedAt: "desc" },
      take: 10,
    });
  });

  it("creates an alert tied to a snapshot", async () => {
    mockPrisma.reliabilityAlert.create.mockResolvedValue({ id: "alert-1" });
    await createReliabilityAlert({
      layer: "interest_keys",
      kappa: 0.45,
      sampleSize: 60,
      snapshotId: "snap-1",
    });
    expect(mockPrisma.reliabilityAlert.create).toHaveBeenCalledWith({
      data: {
        layer: "interest_keys",
        kappa: 0.45,
        sampleSize: 60,
        snapshotId: "snap-1",
      },
    });
  });

  it("listUnacknowledgedAlerts filters by acknowledgedAt:null", async () => {
    mockPrisma.reliabilityAlert.findMany.mockResolvedValue([]);
    await listUnacknowledgedAlerts();
    expect(mockPrisma.reliabilityAlert.findMany).toHaveBeenCalledWith({
      where: { acknowledgedAt: null },
      orderBy: { createdAt: "desc" },
    });
  });

  it("acknowledgeAlert sets acknowledgedAt + acknowledgedBy", async () => {
    mockPrisma.reliabilityAlert.update.mockResolvedValue({ id: "alert-1" });
    await acknowledgeAlert("alert-1", "user-admin");
    const args = mockPrisma.reliabilityAlert.update.mock.calls[0][0];
    expect(args.where).toEqual({ id: "alert-1" });
    expect(args.data.acknowledgedBy).toBe("user-admin");
    expect(args.data.acknowledgedAt).toBeInstanceOf(Date);
  });
});
