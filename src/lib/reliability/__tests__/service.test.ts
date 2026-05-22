import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    discovery: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    interestSignal: {
      findMany: vi.fn(),
    },
    mission: {
      findMany: vi.fn(),
    },
    child: {
      findMany: vi.fn(),
    },
    discoveryRating: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    reliabilitySnapshot: {
      create: vi.fn(),
    },
    reliabilityAlert: {
      create: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/db";
import {
  KAPPA_ADEQUACY_THRESHOLD,
  MIN_SAMPLE_FOR_SURFACE,
  computeLiveKappa,
  runSnapshotJob,
  submitRating,
} from "@/lib/reliability/service";

interface MockShape {
  discovery: {
    findUnique: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
  };
  interestSignal: { findMany: ReturnType<typeof vi.fn> };
  mission: { findMany: ReturnType<typeof vi.fn> };
  child: { findMany: ReturnType<typeof vi.fn> };
  discoveryRating: {
    create: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
  };
  reliabilitySnapshot: { create: ReturnType<typeof vi.fn> };
  reliabilityAlert: { create: ReturnType<typeof vi.fn> };
}

const mockPrisma = prisma as unknown as MockShape;

beforeEach(() => {
  vi.clearAllMocks();
  // Default empty datasets for the test-retest + longitudinal + bias snapshots
  // that also run inside runSnapshotJob.
  mockPrisma.discovery.findMany.mockResolvedValue([]);
  mockPrisma.interestSignal.findMany.mockResolvedValue([]);
  mockPrisma.mission.findMany.mockResolvedValue([]);
  mockPrisma.child.findMany.mockResolvedValue([]);
});

describe("submitRating — AI label snapshotting", () => {
  it("snapshots AI labels from Discovery.detectedTalents + InterestSignal rows", async () => {
    mockPrisma.discovery.findUnique.mockResolvedValue({
      id: "discovery-1",
      detectedTalents: JSON.stringify([
        { name: "Robotics", category: "Engineering", confidence: 0.9 },
        { name: "Sketching", category: "Art", confidence: 0.8 },
      ]),
    });
    mockPrisma.interestSignal.findMany.mockResolvedValue([
      { interestKey: "building" },
      { interestKey: "art" },
      { interestKey: "building" }, // dup -> dedupe expected
    ]);
    mockPrisma.discoveryRating.create.mockResolvedValue({ id: "rating-1" });

    await submitRating({
      discoveryId: "discovery-1",
      raterUserId: "user-admin",
      humanInterestKeys: ["art"],
      humanTagCategories: ["Art"],
    });

    const data = mockPrisma.discoveryRating.create.mock.calls[0][0].data;
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
    mockPrisma.discovery.findUnique.mockResolvedValue(null);
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
    // Provide only 3 rated items, well below MIN.
    mockPrisma.discoveryRating.findMany.mockResolvedValue([
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
    // Build 50 perfect-agreement items so Kappa = 1.
    const items = Array.from({ length: MIN_SAMPLE_FOR_SURFACE }, (_, i) => ({
      id: `r-${i}`,
      humanInterestKeys: JSON.stringify(["art"]),
      aiInterestKeysAtRate: JSON.stringify(["art"]),
      humanTagCategories: JSON.stringify([]),
      aiTagCategoriesAtRate: JSON.stringify([]),
    }));
    mockPrisma.discoveryRating.findMany.mockResolvedValue(items);

    const res = await computeLiveKappa("interest_keys");
    expect(res.kappa).toBe(1);
    expect(res.sampleSize).toBe(MIN_SAMPLE_FOR_SURFACE);
    expect(res.needed).toBe(0);
  });
});

describe("runSnapshotJob", () => {
  it("writes a snapshot per layer and creates alerts when Kappa < threshold and sample is sufficient", async () => {
    // 50 items, all-disagree on the single label "art" with balanced marginals -> Kappa = -1.
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
    mockPrisma.discoveryRating.findMany.mockResolvedValue(items);
    mockPrisma.reliabilitySnapshot.create.mockImplementation(
      async ({ data }) => ({
        id: `snap-${data.layer}`,
        ...data,
      }),
    );
    mockPrisma.reliabilityAlert.create.mockResolvedValue({ id: "alert" });

    const result = await runSnapshotJob("cron");

    // Two snapshots written, one per layer.
    expect(mockPrisma.reliabilitySnapshot.create).toHaveBeenCalledTimes(2);
    // Two alerts created (both layers below threshold).
    expect(mockPrisma.reliabilityAlert.create).toHaveBeenCalledTimes(2);
    expect(result.snapshotsCreated).toBe(2);
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
    mockPrisma.discoveryRating.findMany.mockResolvedValue(items);
    mockPrisma.reliabilitySnapshot.create.mockImplementation(
      async ({ data }) => ({ id: `snap-${data.layer}`, ...data }),
    );

    const result = await runSnapshotJob("manual");
    expect(mockPrisma.reliabilityAlert.create).not.toHaveBeenCalled();
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
    mockPrisma.discoveryRating.findMany.mockResolvedValue(items);
    mockPrisma.reliabilitySnapshot.create.mockImplementation(
      async ({ data }) => ({ id: `snap-${data.layer}`, ...data }),
    );

    const result = await runSnapshotJob("cron");
    expect(mockPrisma.reliabilityAlert.create).not.toHaveBeenCalled();
    expect(result.alertsCreated).toBe(0);
  });
});
