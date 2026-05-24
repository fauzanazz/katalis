import { beforeEach, describe, expect, it, vi } from "vitest";

const mockDb = vi.hoisted(() => ({
  query: {
    discoveries: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    discoveryRatings: {
      findMany: vi.fn(),
    },
    interestSignals: {
      findMany: vi.fn(),
    },
    missions: {
      findMany: vi.fn(),
    },
    children: {
      findMany: vi.fn(),
    },
    reliabilitySnapshots: {
      findMany: vi.fn(),
    },
    reliabilityAlerts: {
      findMany: vi.fn(),
    },
  },
  insert: vi.fn(),
  update: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ db: mockDb }));

import {
  KAPPA_ADEQUACY_THRESHOLD,
  MIN_SAMPLE_FOR_SURFACE,
  computeLiveKappa,
  runSnapshotJob,
  submitRating,
} from "@/lib/reliability/service";

// Helper to set up insert chain for a table
function setupInsertChain(returnRow: Record<string, unknown>) {
  const returning = vi.fn().mockResolvedValue([returnRow]);
  const values = vi.fn().mockReturnValue({ returning });
  mockDb.insert.mockReturnValue({ values });
  return { values, returning };
}

beforeEach(() => {
  vi.clearAllMocks();
  // Default empty datasets for the test-retest + longitudinal + bias snapshots
  // that also run inside runSnapshotJob.
  mockDb.query.discoveries.findMany.mockResolvedValue([]);
  mockDb.query.interestSignals.findMany.mockResolvedValue([]);
  mockDb.query.missions.findMany.mockResolvedValue([]);
  mockDb.query.children.findMany.mockResolvedValue([]);
  mockDb.query.reliabilitySnapshots.findMany.mockResolvedValue([]);
  mockDb.query.reliabilityAlerts.findMany.mockResolvedValue([]);
});

describe("submitRating — AI label snapshotting", () => {
  it("snapshots AI labels from Discovery.detectedTalents + InterestSignal rows", async () => {
    mockDb.query.discoveries.findFirst.mockResolvedValue({
      id: "discovery-1",
      detectedTalents: JSON.stringify([
        { name: "Robotics", category: "Engineering", confidence: 0.9 },
        { name: "Sketching", category: "Art", confidence: 0.8 },
      ]),
    });
    mockDb.query.interestSignals.findMany.mockResolvedValue([
      { interestKey: "building" },
      { interestKey: "art" },
      { interestKey: "building" }, // dup -> dedupe expected
    ]);
    const { values } = setupInsertChain({ id: "rating-1" });

    await submitRating({
      discoveryId: "discovery-1",
      raterUserId: "user-admin",
      humanInterestKeys: ["art"],
      humanTagCategories: ["Art"],
    });

    expect(values).toHaveBeenCalledTimes(1);
    const data = values.mock.calls[0][0];
    expect(data.discoveryId).toBe("discovery-1");
    expect(data.raterUserId).toBe("user-admin");
    expect(JSON.parse(data.aiTagCategoriesAtRate).sort()).toEqual([
      "Art",
      "Engineering",
    ]);
    expect(JSON.parse(data.aiInterestKeysAtRate).sort()).toEqual([
      "art",
      "building",
    ]);
  });

  it("throws when discovery does not exist", async () => {
    mockDb.query.discoveries.findFirst.mockResolvedValue(null);
    await expect(
      submitRating({
        discoveryId: "missing",
        raterUserId: "user-admin",
        humanInterestKeys: [],
        humanTagCategories: [],
      }),
    ).rejects.toThrow(/discovery/i);
  });
});

describe("computeLiveKappa", () => {
  it("returns null kappa with insufficient sample marker below MIN_SAMPLE_FOR_SURFACE", async () => {
    mockDb.query.discoveryRatings.findMany.mockResolvedValue([
      {
        id: "r-1",
        humanInterestKeys: JSON.stringify(["art"]),
        aiInterestKeysAtRate: JSON.stringify(["art"]),
        humanTagCategories: JSON.stringify([]),
        aiTagCategoriesAtRate: JSON.stringify([]),
      },
      {
        id: "r-2",
        humanInterestKeys: JSON.stringify(["art"]),
        aiInterestKeysAtRate: JSON.stringify(["art"]),
        humanTagCategories: JSON.stringify([]),
        aiTagCategoriesAtRate: JSON.stringify([]),
      },
      {
        id: "r-3",
        humanInterestKeys: JSON.stringify(["art"]),
        aiInterestKeysAtRate: JSON.stringify(["art"]),
        humanTagCategories: JSON.stringify([]),
        aiTagCategoriesAtRate: JSON.stringify([]),
      },
    ]);

    const res = await computeLiveKappa("interest_keys");
    expect(res.kappa).toBeNull();
    expect(res.sampleSize).toBe(3);
    expect(res.needed).toBe(MIN_SAMPLE_FOR_SURFACE - 3);
  });

  it("returns the macro Kappa when sample is sufficient", async () => {
    const items = Array.from({ length: MIN_SAMPLE_FOR_SURFACE }, (_, i) => ({
      id: `r-${i}`,
      humanInterestKeys: JSON.stringify(["art"]),
      aiInterestKeysAtRate: JSON.stringify(["art"]),
      humanTagCategories: JSON.stringify([]),
      aiTagCategoriesAtRate: JSON.stringify([]),
    }));
    mockDb.query.discoveryRatings.findMany.mockResolvedValue(items);

    const res = await computeLiveKappa("interest_keys");
    expect(res.kappa).toBe(1);
    expect(res.sampleSize).toBe(MIN_SAMPLE_FOR_SURFACE);
    expect(res.needed).toBe(0);
  });
});

describe("runSnapshotJob", () => {
  it("writes a snapshot per layer and creates alerts when Kappa < threshold and sample is sufficient", async () => {
    const items = Array.from({ length: MIN_SAMPLE_FOR_SURFACE }, (_, i) => {
      const aiHasArt = i % 2 === 0;
      const humanHasArt = !aiHasArt;
      return {
        id: `r-${i}`,
        humanInterestKeys: JSON.stringify(humanHasArt ? ["art"] : []),
        aiInterestKeysAtRate: JSON.stringify(aiHasArt ? ["art"] : []),
        humanTagCategories: JSON.stringify(humanHasArt ? ["Art"] : []),
        aiTagCategoriesAtRate: JSON.stringify(aiHasArt ? ["Art"] : []),
      };
    });
    mockDb.query.discoveryRatings.findMany.mockResolvedValue(items);

    // Each insert call (snapshot or alert) returns a row with a generated id
    let insertCallCount = 0;
    mockDb.insert.mockImplementation(() => {
      insertCallCount++;
      const callNum = insertCallCount;
      const returning = vi.fn().mockResolvedValue([{ id: `inserted-${callNum}` }]);
      const values = vi.fn().mockReturnValue({ returning });
      return { values };
    });

    const result = await runSnapshotJob("cron");

    // Two snapshots written, one per layer.
    expect(result.snapshotsCreated).toBe(2);
    // Two alerts created (both layers below threshold).
    expect(result.alertsCreated).toBe(2);
    expect(KAPPA_ADEQUACY_THRESHOLD).toBeLessThan(1);
  });

  it("does not create alerts when Kappa is above threshold", async () => {
    const items = Array.from({ length: MIN_SAMPLE_FOR_SURFACE }, (_, i) => ({
      id: `r-${i}`,
      humanInterestKeys: JSON.stringify(["art"]),
      aiInterestKeysAtRate: JSON.stringify(["art"]),
      humanTagCategories: JSON.stringify(["Art"]),
      aiTagCategoriesAtRate: JSON.stringify(["Art"]),
    }));
    mockDb.query.discoveryRatings.findMany.mockResolvedValue(items);

    const insertedIds: string[] = [];
    mockDb.insert.mockImplementation(() => {
      const returning = vi.fn().mockImplementation(async () => {
        const id = `snap-${insertedIds.length}`;
        insertedIds.push(id);
        return [{ id }];
      });
      const values = vi.fn().mockReturnValue({ returning });
      return { values };
    });

    const result = await runSnapshotJob("manual");
    expect(result.alertsCreated).toBe(0);
  });

  it("does not create alerts when sample is below MIN_SAMPLE_FOR_SURFACE", async () => {
    const items = Array.from({ length: 3 }, (_, i) => {
      const aiHasArt = i % 2 === 0;
      const humanHasArt = !aiHasArt;
      return {
        id: `r-${i}`,
        humanInterestKeys: JSON.stringify(humanHasArt ? ["art"] : []),
        aiInterestKeysAtRate: JSON.stringify(aiHasArt ? ["art"] : []),
        humanTagCategories: JSON.stringify(humanHasArt ? ["Art"] : []),
        aiTagCategoriesAtRate: JSON.stringify(aiHasArt ? ["Art"] : []),
      };
    });
    mockDb.query.discoveryRatings.findMany.mockResolvedValue(items);

    mockDb.insert.mockImplementation(() => {
      const returning = vi.fn().mockResolvedValue([{ id: "snap-x" }]);
      const values = vi.fn().mockReturnValue({ returning });
      return { values };
    });

    const result = await runSnapshotJob("cron");
    expect(result.alertsCreated).toBe(0);
  });
});
