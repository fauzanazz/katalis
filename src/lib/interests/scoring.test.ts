import { describe, expect, it } from "vitest";

import {
  computeInterestScore,
  computeRecencyWeight,
  computeStability,
  computeTrend,
  countDistinctDays,
  DIMENSION_WEIGHTS,
  RECENCY_HALF_LIFE_DAYS,
} from "./scoring";

const DAY = 24 * 60 * 60 * 1000;

function daysAgo(days: number, now = new Date()): Date {
  return new Date(now.getTime() - days * DAY);
}

describe("computeRecencyWeight (EMA — exponential decay)", () => {
  it("returns 1 when observedAt equals now", () => {
    const now = new Date();
    expect(computeRecencyWeight(now, now)).toBe(1);
  });

  it("returns 0.5 at one half-life", () => {
    const now = new Date();
    expect(computeRecencyWeight(daysAgo(RECENCY_HALF_LIFE_DAYS, now), now)).toBeCloseTo(0.5, 5);
  });

  it("returns 0.25 at two half-lives", () => {
    const now = new Date();
    expect(
      computeRecencyWeight(daysAgo(RECENCY_HALF_LIFE_DAYS * 2, now), now),
    ).toBeCloseTo(0.25, 5);
  });

  it("decays monotonically with age", () => {
    const now = new Date();
    const w7 = computeRecencyWeight(daysAgo(7, now), now);
    const w21 = computeRecencyWeight(daysAgo(21, now), now);
    const w60 = computeRecencyWeight(daysAgo(60, now), now);
    expect(w7).toBeGreaterThan(w21);
    expect(w21).toBeGreaterThan(w60);
  });

  it("clamps future observations to weight 1 (no >1 amplification)", () => {
    const now = new Date();
    const future = new Date(now.getTime() + 5 * DAY);
    expect(computeRecencyWeight(future, now)).toBe(1);
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

  it("applies EMA recency weight to older signals (half-life = 21d)", () => {
    const now = new Date();
    const signals = [
      {
        strength: 1,
        confidence: 1,
        dimension: "engagement" as const,
        observedAt: daysAgo(RECENCY_HALF_LIFE_DAYS, now),
      },
    ];
    // contribution = 1 * 1 * 1.0 * 0.5 ≈ 0.5 at one half-life
    expect(computeInterestScore(signals, now)).toBeCloseTo(0.5, 2);
  });

  it("older signals contribute less than recent (monotonic decay)", () => {
    const now = new Date();
    const recent = computeInterestScore(
      [{ strength: 1, confidence: 1, dimension: "engagement", observedAt: daysAgo(0, now) }],
      now,
    );
    const old = computeInterestScore(
      [{ strength: 1, confidence: 1, dimension: "engagement", observedAt: daysAgo(60, now) }],
      now,
    );
    expect(recent).toBeGreaterThan(old);
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

describe("computeStability", () => {
  it("returns fleeting with no observations", () => {
    expect(computeStability([], new Date())).toBe("fleeting");
  });

  it("returns fleeting when all observations on the same day", () => {
    const now = new Date();
    const obs = [daysAgo(0, now), daysAgo(0, now)];
    expect(computeStability(obs, now)).toBe("fleeting");
  });

  it("returns emerging when 2 distinct days within 14d span", () => {
    const now = new Date();
    const obs = [daysAgo(0, now), daysAgo(5, now)];
    expect(computeStability(obs, now)).toBe("emerging");
  });

  it("returns sustained when ≥3 distinct days AND span ≥14d", () => {
    const now = new Date();
    const obs = [daysAgo(0, now), daysAgo(7, now), daysAgo(20, now)];
    expect(computeStability(obs, now)).toBe("sustained");
  });

  it("returns emerging when 3 distinct days but span <14d", () => {
    const now = new Date();
    const obs = [daysAgo(0, now), daysAgo(3, now), daysAgo(10, now)];
    expect(computeStability(obs, now)).toBe("emerging");
  });
});

describe("countDistinctDays", () => {
  it("returns 0 for empty observations", () => {
    expect(countDistinctDays([])).toBe(0);
  });

  it("collapses same-day observations to one", () => {
    const t = new Date("2026-05-20T10:00:00Z");
    const t2 = new Date("2026-05-20T22:30:00Z");
    expect(countDistinctDays([t, t2])).toBe(1);
  });

  it("counts distinct calendar days", () => {
    const obs = [
      new Date("2026-05-20T10:00:00Z"),
      new Date("2026-05-21T10:00:00Z"),
      new Date("2026-05-25T10:00:00Z"),
    ];
    expect(countDistinctDays(obs)).toBe(3);
  });
});
