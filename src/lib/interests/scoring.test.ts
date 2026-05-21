import { describe, expect, it } from "vitest";

import {
  computeInterestScore,
  computeRecencyWeight,
  computeTrend,
  DIMENSION_WEIGHTS,
} from "./scoring";

const DAY = 24 * 60 * 60 * 1000;

function daysAgo(days: number, now = new Date()): Date {
  return new Date(now.getTime() - days * DAY);
}

describe("computeRecencyWeight", () => {
  it("returns 1 for signals within 7 days", () => {
    const now = new Date();
    expect(computeRecencyWeight(daysAgo(0, now), now)).toBe(1);
    expect(computeRecencyWeight(daysAgo(7, now), now)).toBe(1);
  });

  it("returns 0.75 for signals 8-30 days ago", () => {
    const now = new Date();
    expect(computeRecencyWeight(daysAgo(8, now), now)).toBe(0.75);
    expect(computeRecencyWeight(daysAgo(30, now), now)).toBe(0.75);
  });

  it("returns 0.5 for signals 31-90 days ago", () => {
    const now = new Date();
    expect(computeRecencyWeight(daysAgo(31, now), now)).toBe(0.5);
    expect(computeRecencyWeight(daysAgo(90, now), now)).toBe(0.5);
  });

  it("returns 0.25 for signals older than 90 days", () => {
    const now = new Date();
    expect(computeRecencyWeight(daysAgo(91, now), now)).toBe(0.25);
    expect(computeRecencyWeight(daysAgo(365, now), now)).toBe(0.25);
  });
});

describe("DIMENSION_WEIGHTS", () => {
  it("has correct weights", () => {
    expect(DIMENSION_WEIGHTS.engagement).toBe(1.0);
    expect(DIMENSION_WEIGHTS.persistence).toBe(1.15);
    expect(DIMENSION_WEIGHTS.joy).toBe(1.1);
    expect(DIMENSION_WEIGHTS.curiosity).toBe(1.05);
    expect(DIMENSION_WEIGHTS.independence).toBe(1.0);
    expect(DIMENSION_WEIGHTS.repeat_request).toBe(1.2);
    expect(DIMENSION_WEIGHTS.skill_growth).toBe(1.0);
    expect(DIMENSION_WEIGHTS.frustration).toBe(-0.8);
  });
});

describe("computeInterestScore", () => {
  it("returns 0 for empty signals", () => {
    expect(computeInterestScore([], new Date())).toBe(0);
  });

  it("computes contribution = strength * confidence * dimensionWeight * recencyWeight", () => {
    const now = new Date();
    const signals = [
      {
        strength: 1,
        confidence: 1,
        dimension: "engagement" as const,
        observedAt: now,
      },
    ];
    // contribution = 1 * 1 * 1.0 * 1 = 1, clamped to 1
    expect(computeInterestScore(signals, now)).toBe(1);
  });

  it("sums contributions across signals and clamps to 0..1", () => {
    const now = new Date();
    const signals = [
      { strength: 1, confidence: 1, dimension: "repeat_request" as const, observedAt: now },
      { strength: 1, confidence: 1, dimension: "persistence" as const, observedAt: now },
    ];
    // sum = 1.2 + 1.15 = 2.35, clamped to 1
    expect(computeInterestScore(signals, now)).toBe(1);
  });

  it("clamps score to 0 minimum (never negative)", () => {
    const now = new Date();
    const signals = [
      { strength: 1, confidence: 1, dimension: "frustration" as const, observedAt: now },
    ];
    // contribution = 1 * 1 * -0.8 * 1 = -0.8, clamped to 0
    expect(computeInterestScore(signals, now)).toBe(0);
  });

  it("applies recency weight to older signals", () => {
    const now = new Date();
    const signals = [
      {
        strength: 1,
        confidence: 1,
        dimension: "engagement" as const,
        observedAt: daysAgo(60, now),
      },
    ];
    // contribution = 1 * 1 * 1.0 * 0.5 = 0.5
    expect(computeInterestScore(signals, now)).toBeCloseTo(0.5);
  });

  it("uses confidence in formula", () => {
    const now = new Date();
    const signals = [
      {
        strength: 1,
        confidence: 0.5,
        dimension: "joy" as const,
        observedAt: now,
      },
    ];
    // contribution = 1 * 0.5 * 1.1 * 1 = 0.55
    expect(computeInterestScore(signals, now)).toBeCloseTo(0.55);
  });

  it("ignores signals with invalid dimension — no NaN, returns 0", () => {
    const now = new Date();
    const signals = [
      {
        strength: 1,
        confidence: 1,
        dimension: "not_a_real_dimension" as never,
        observedAt: now,
      },
    ];
    const score = computeInterestScore(signals, now);
    expect(Number.isNaN(score)).toBe(false);
    expect(score).toBe(0);
  });

  it("mixes valid and invalid dimension signals — only valid ones contribute", () => {
    const now = new Date();
    const signals = [
      { strength: 1, confidence: 1, dimension: "engagement" as const, observedAt: now },
      { strength: 1, confidence: 1, dimension: "garbage_dim" as never, observedAt: now },
    ];
    // only engagement contributes: 1 * 1 * 1.0 * 1 = 1.0
    expect(computeInterestScore(signals, now)).toBe(1);
  });
});

describe("computeTrend", () => {
  it("returns stable when no signals", () => {
    expect(computeTrend([], new Date())).toBe("stable");
  });

  it("returns rising when last30 - prev30 > 0.15", () => {
    const now = new Date();
    const recentSignals = [
      { strength: 1, confidence: 1, dimension: "engagement" as const, observedAt: daysAgo(5, now) },
    ];
    const oldSignals = [
      { strength: 0.1, confidence: 0.5, dimension: "engagement" as const, observedAt: daysAgo(45, now) },
    ];
    // last30 ≈ 1.0, prev30 ≈ 0.05 -> diff > 0.15 -> rising
    const trend = computeTrend([...recentSignals, ...oldSignals], now);
    expect(trend).toBe("rising");
  });

  it("returns falling when last30 - prev30 < -0.15", () => {
    const now = new Date();
    const recentSignals = [
      { strength: 0.1, confidence: 0.5, dimension: "engagement" as const, observedAt: daysAgo(5, now) },
    ];
    const oldSignals = [
      { strength: 1, confidence: 1, dimension: "engagement" as const, observedAt: daysAgo(45, now) },
    ];
    const trend = computeTrend([...recentSignals, ...oldSignals], now);
    expect(trend).toBe("falling");
  });

  it("returns stable when diff within -0.15..0.15", () => {
    const now = new Date();
    const signals = [
      { strength: 0.1, confidence: 1, dimension: "engagement" as const, observedAt: daysAgo(5, now) },
      { strength: 0.1, confidence: 1, dimension: "engagement" as const, observedAt: daysAgo(45, now) },
    ];
    expect(computeTrend(signals, now)).toBe("stable");
  });

  it("returns stable and no NaN when all signals have invalid dimension", () => {
    const now = new Date();
    const signals = [
      { strength: 1, confidence: 1, dimension: "bad_dim" as never, observedAt: daysAgo(5, now) },
    ];
    const trend = computeTrend(signals, now);
    expect(trend).toBe("stable");
  });
});
