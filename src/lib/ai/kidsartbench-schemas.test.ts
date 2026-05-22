import { describe, expect, it } from "vitest";

import {
  completeScore,
  GARDNER_MAPPING,
  KIDSART_BENCH_DIMENSIONS,
  KidsArtBenchScoreSchema,
  mapToGardner,
} from "./kidsartbench-schemas";

describe("KidsArtBenchScoreSchema", () => {
  it("has exactly 9 dimensions", () => {
    expect(KIDSART_BENCH_DIMENSIONS).toHaveLength(9);
  });

  it("rejects scores outside [0,1]", () => {
    const result = KidsArtBenchScoreSchema.safeParse({
      structure: 1.5,
      color: 0.5,
      detail: 0.5,
      spatial: 0.5,
      logic: 0.5,
      composition: 0.5,
      originality: 0.5,
      narrative: 0.5,
      technique: 0.5,
    });
    expect(result.success).toBe(false);
  });

  it("accepts a valid 9-dim score object", () => {
    const result = KidsArtBenchScoreSchema.safeParse(completeScore({}, 0.5));
    expect(result.success).toBe(true);
  });

  it("rejects when any dimension is missing", () => {
    const partial = {
      structure: 0.5,
      color: 0.5,
      detail: 0.5,
      spatial: 0.5,
      logic: 0.5,
      composition: 0.5,
      originality: 0.5,
      narrative: 0.5,
      // technique missing
    };
    const result = KidsArtBenchScoreSchema.safeParse(partial);
    expect(result.success).toBe(false);
  });
});

describe("Gardner mapping", () => {
  it("covers all 9 dimensions", () => {
    for (const dim of KIDSART_BENCH_DIMENSIONS) {
      expect(GARDNER_MAPPING[dim].length).toBeGreaterThan(0);
    }
  });

  it("aggregates dimension scores by Gardner intelligence (average)", () => {
    const score = completeScore({ logic: 1, structure: 1, spatial: 1, color: 0 }, 0);
    const gardner = mapToGardner(score);
    // logic and structure both map to logical_mathematical → average = 1
    expect(gardner.logical_mathematical).toBeCloseTo(1, 5);
    // spatial maps to "spatial" + "bodily_kinesthetic"; structure & composition also map to "spatial"
    expect(gardner.spatial).toBeGreaterThan(0);
  });

  it("returns 0 for an intelligence whose dimensions are all 0", () => {
    const score = completeScore({}, 0);
    const gardner = mapToGardner(score);
    for (const v of Object.values(gardner)) {
      expect(v).toBe(0);
    }
  });
});

describe("completeScore", () => {
  it("fills missing dimensions with the fallback", () => {
    const filled = completeScore({ structure: 0.9 }, 0.3);
    expect(filled.structure).toBe(0.9);
    expect(filled.color).toBe(0.3);
    expect(filled.technique).toBe(0.3);
  });

  it("defaults fallback to 0.5", () => {
    const filled = completeScore({});
    for (const dim of KIDSART_BENCH_DIMENSIONS) {
      expect(filled[dim]).toBe(0.5);
    }
  });
});
