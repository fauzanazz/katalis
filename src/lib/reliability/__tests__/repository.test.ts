import { beforeEach, describe, expect, it, vi } from "vitest";

const mockDb = vi.hoisted(() => {
  const insertValuesReturning = vi.fn().mockResolvedValue([{ id: "inserted-1" }]);
  const insertValuesChain = {
    returning: insertValuesReturning,
  };
  const insertValues = vi.fn().mockReturnValue(insertValuesChain);
  const insertChain = { values: insertValues };

  const updateSetWhereReturning = vi.fn().mockResolvedValue([{ id: "updated-1" }]);
  const updateSetWhere = vi.fn().mockReturnValue({ returning: updateSetWhereReturning });
  const updateSet = vi.fn().mockReturnValue({ where: updateSetWhere });
  const updateChain = { set: updateSet };

  return {
    query: {
      discoveryRatings: { findMany: vi.fn() },
      discoveries: { findMany: vi.fn(), findFirst: vi.fn() },
      reliabilitySnapshots: { findMany: vi.fn() },
      reliabilityAlerts: { findMany: vi.fn() },
    },
    insert: vi.fn().mockReturnValue(insertChain),
    update: vi.fn().mockReturnValue(updateChain),
    // expose inner mocks for assertion
    _insertValues: insertValues,
    _insertValuesReturning: insertValuesReturning,
    _updateSet: updateSet,
    _updateSetWhere: updateSetWhere,
    _updateSetWhereReturning: updateSetWhereReturning,
  };
});

vi.mock("@/lib/db", () => ({ db: mockDb }));

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

beforeEach(() => {
  vi.clearAllMocks();
  // Re-wire chains after clearAllMocks
  const insertValuesReturning = vi.fn().mockResolvedValue([{ id: "inserted-1" }]);
  const insertValuesChain = { returning: insertValuesReturning };
  const insertValues = vi.fn().mockReturnValue(insertValuesChain);
  mockDb.insert.mockReturnValue({ values: insertValues });
  mockDb._insertValues = insertValues;
  mockDb._insertValuesReturning = insertValuesReturning;

  const updateSetWhereReturning = vi.fn().mockResolvedValue([{ id: "updated-1" }]);
  const updateSetWhere = vi.fn().mockReturnValue({ returning: updateSetWhereReturning });
  const updateSet = vi.fn().mockReturnValue({ where: updateSetWhere });
  mockDb.update.mockReturnValue({ set: updateSet });
  mockDb._updateSet = updateSet;
  mockDb._updateSetWhere = updateSetWhere;
  mockDb._updateSetWhereReturning = updateSetWhereReturning;
});

describe("reliability repository — createDiscoveryRating", () => {
  it("serializes label arrays to JSON and persists with rater id", async () => {
    await createDiscoveryRating({
      discoveryId: "discovery-1",
      raterUserId: "user-admin",
      humanInterestKeys: ["nature", "art"],
      humanTagCategories: ["Art", "Creative"],
      aiInterestKeysAtRate: ["nature"],
      aiTagCategoriesAtRate: ["Art"],
      notes: "looked confident",
    });

    expect(mockDb._insertValues).toHaveBeenCalledWith({
      discoveryId: "discovery-1",
      raterUserId: "user-admin",
      humanInterestKeys: JSON.stringify(["nature", "art"]),
      humanTagCategories: JSON.stringify(["Art", "Creative"]),
      aiInterestKeysAtRate: JSON.stringify(["nature"]),
      aiTagCategoriesAtRate: JSON.stringify(["Art"]),
      notes: "looked confident",
    });
  });
});

describe("reliability repository — listRatedItems", () => {
  it("parses interest-keys layer into RatingPair sets", async () => {
    mockDb.query.discoveryRatings.findMany.mockResolvedValue([
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
    mockDb.query.discoveryRatings.findMany.mockResolvedValue([
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
    mockDb.query.discoveryRatings.findMany.mockResolvedValue([]);
    mockDb.query.discoveries.findMany.mockResolvedValue([
      { id: "discovery-7", detectedTalents: null },
    ]);

    const result = await findNextUnratedDiscoveryForUser("user-admin");
    expect(result?.id).toBe("discovery-7");
  });

  it("returns null when no unrated discoveries remain", async () => {
    mockDb.query.discoveryRatings.findMany.mockResolvedValue([
      { discoveryId: "discovery-7" },
    ]);
    mockDb.query.discoveries.findMany.mockResolvedValue([
      { id: "discovery-7", detectedTalents: null },
    ]);

    const result = await findNextUnratedDiscoveryForUser("user-admin");
    expect(result).toBeNull();
  });
});

describe("reliability repository — snapshots + alerts", () => {
  it("stores snapshot payload as JSON", async () => {
    await createReliabilitySnapshot({
      layer: "interest_keys",
      kappa: 0.72,
      sampleSize: 52,
      payload: { perLabel: [], topConfused: [] },
      triggeredBy: "cron",
    });

    expect(mockDb._insertValues).toHaveBeenCalledWith({
      layer: "interest_keys",
      kappa: 0.72,
      sampleSize: 52,
      payloadJson: JSON.stringify({ perLabel: [], topConfused: [] }),
      triggeredBy: "cron",
    });
  });

  it("lists recent snapshots ordered by computedAt desc", async () => {
    mockDb.query.reliabilitySnapshots.findMany.mockResolvedValue([]);
    await listRecentSnapshots("tag_categories", 10);
    expect(mockDb.query.reliabilitySnapshots.findMany).toHaveBeenCalledTimes(1);
    const callArg = mockDb.query.reliabilitySnapshots.findMany.mock.calls[0][0];
    expect(callArg.limit).toBe(10);
  });

  it("creates an alert tied to a snapshot", async () => {
    await createReliabilityAlert({
      layer: "interest_keys",
      kappa: 0.45,
      sampleSize: 60,
      snapshotId: "snap-1",
    });
    expect(mockDb._insertValues).toHaveBeenCalledWith({
      layer: "interest_keys",
      kappa: 0.45,
      sampleSize: 60,
      snapshotId: "snap-1",
    });
  });

  it("listUnacknowledgedAlerts queries alerts", async () => {
    mockDb.query.reliabilityAlerts.findMany.mockResolvedValue([]);
    await listUnacknowledgedAlerts();
    expect(mockDb.query.reliabilityAlerts.findMany).toHaveBeenCalledTimes(1);
  });

  it("acknowledgeAlert sets acknowledgedAt + acknowledgedBy", async () => {
    await acknowledgeAlert("alert-1", "user-admin");
    const setCall = mockDb._updateSet.mock.calls[0][0];
    expect(setCall.acknowledgedBy).toBe("user-admin");
    expect(setCall.acknowledgedAt).toBeInstanceOf(Date);
  });
});
