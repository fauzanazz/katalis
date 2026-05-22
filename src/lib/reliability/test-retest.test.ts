import { describe, expect, it } from "vitest";

import {
  computeChildConsistency,
  jaccardSimilarity,
} from "./test-retest";

const DAY_MS = 24 * 60 * 60 * 1000;

function row(daysOld: number, talents: string[]) {
  return {
    childId: "child-1",
    createdAt: new Date(Date.now() - daysOld * DAY_MS),
    detectedTalents: JSON.stringify(
      talents.map((category) => ({ category, name: category, confidence: 0.8 })),
    ),
  };
}

describe("jaccardSimilarity", () => {
  it("returns 1 for two empty sets", () => {
    expect(jaccardSimilarity(new Set(), new Set())).toBe(1);
  });

  it("returns 1 for identical sets", () => {
    expect(jaccardSimilarity(new Set(["a", "b"]), new Set(["a", "b"]))).toBe(1);
  });

  it("returns 0 for disjoint sets", () => {
    expect(jaccardSimilarity(new Set(["a"]), new Set(["b"]))).toBe(0);
  });

  it("computes |A∩B| / |A∪B|", () => {
    // A={a,b,c}, B={b,c,d} → ∩=2, ∪=4 → 0.5
    expect(jaccardSimilarity(new Set(["a", "b", "c"]), new Set(["b", "c", "d"]))).toBeCloseTo(0.5);
  });
});

describe("computeChildConsistency", () => {
  it("returns 0 pairs and 0 jaccard when only one observation", () => {
    const r = computeChildConsistency([row(0, ["art"])]);
    expect(r.pairCount).toBe(0);
    expect(r.meanJaccard).toBe(0);
  });

  it("forms a pair when two observations are within the window and beyond min-gap", () => {
    const r = computeChildConsistency([row(2, ["art", "music"]), row(0, ["art", "music"])]);
    expect(r.pairCount).toBe(1);
    expect(r.meanJaccard).toBeCloseTo(1);
  });

  it("skips pairs inside the min-gap (same-day)", () => {
    const r = computeChildConsistency(
      [row(0, ["art"]), row(0, ["art"])],
      30,
      6, // 6h gap required
    );
    expect(r.pairCount).toBe(0);
  });

  it("skips pairs beyond the window", () => {
    const r = computeChildConsistency([
      row(40, ["art"]),
      row(0, ["music"]),
    ]);
    expect(r.pairCount).toBe(0);
  });

  it("averages jaccard across multiple pairs", () => {
    // A → {art}, B → {art, music}, C → {music}
    // pairs: (A,B)=0.5, (A,C)=0, (B,C)=0.5; mean ≈ 0.333
    const rows = [row(10, ["art"]), row(5, ["art", "music"]), row(0, ["music"])];
    const r = computeChildConsistency(rows);
    expect(r.pairCount).toBe(3);
    expect(r.meanJaccard).toBeCloseTo(1 / 3, 2);
  });
});
