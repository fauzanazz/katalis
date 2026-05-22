import { describe, expect, it } from "vitest";

import { computePerChild, pearsonCorrelation } from "./longitudinal";

const DAY = 24 * 60 * 60 * 1000;

function date(daysFromNow: number): Date {
  return new Date(Date.now() + daysFromNow * DAY);
}

describe("pearsonCorrelation", () => {
  it("returns null when lengths mismatch or n < 2", () => {
    expect(pearsonCorrelation([1], [1])).toBeNull();
    expect(pearsonCorrelation([1, 2], [1])).toBeNull();
  });

  it("returns 1 for perfectly positively correlated vectors", () => {
    expect(pearsonCorrelation([1, 2, 3], [2, 4, 6])).toBeCloseTo(1, 5);
  });

  it("returns -1 for perfectly negatively correlated vectors", () => {
    expect(pearsonCorrelation([1, 2, 3], [6, 4, 2])).toBeCloseTo(-1, 5);
  });

  it("returns null when one vector has zero variance", () => {
    expect(pearsonCorrelation([1, 2, 3], [5, 5, 5])).toBeNull();
  });
});

describe("computePerChild", () => {
  it("returns empty when no signals provided", () => {
    expect(computePerChild([], [], new Date())).toEqual([]);
  });

  it("picks top interest from the early window", () => {
    const now = date(0);
    const signals = [
      // First-week signals — mostly art
      { childId: "c1", interestKey: "art", observedAt: date(-20), strength: 0.6, confidence: 0.8 },
      { childId: "c1", interestKey: "art", observedAt: date(-18), strength: 0.7, confidence: 0.8 },
      { childId: "c1", interestKey: "music", observedAt: date(-19), strength: 0.4, confidence: 0.5 },
    ];
    const missions = [
      { childId: "c1", status: "completed", createdAt: date(-5) },
      { childId: "c1", status: "abandoned", createdAt: date(-4) },
    ];
    const result = computePerChild(signals, missions, now);
    expect(result).toHaveLength(1);
    expect(result[0].earlyTopInterest).toBe("art");
    expect(result[0].sustainedCompletionRate).toBeCloseTo(0.5);
    expect(result[0].sampledMissionCount).toBe(2);
  });

  it("excludes missions inside the early window from completion stats", () => {
    const now = date(0);
    const signals = [
      { childId: "c2", interestKey: "science", observedAt: date(-30), strength: 1, confidence: 1 },
    ];
    const missions = [
      // Inside early window — should be excluded
      { childId: "c2", status: "completed", createdAt: date(-25) },
      // Beyond early window — counted
      { childId: "c2", status: "completed", createdAt: date(-10) },
    ];
    const result = computePerChild(signals, missions, now);
    expect(result[0].sampledMissionCount).toBe(1);
    expect(result[0].sustainedCompletionRate).toBeCloseTo(1);
  });

  it("returns 0 completion rate when no sustained missions exist", () => {
    const now = date(0);
    const signals = [
      { childId: "c3", interestKey: "nature", observedAt: date(-3), strength: 1, confidence: 1 },
    ];
    const result = computePerChild(signals, [], now);
    expect(result[0].sustainedCompletionRate).toBe(0);
    expect(result[0].sampledMissionCount).toBe(0);
  });
});
