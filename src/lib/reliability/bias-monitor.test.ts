import { describe, expect, it } from "vitest";

import { computeBiasRows, flagBiasedInterests } from "./bias-monitor";

function index(rows: Array<{ id: string; locale: string; ageBand: string }>) {
  return new Map(rows.map((r) => [r.id, { locale: r.locale, ageBand: r.ageBand }]));
}

describe("computeBiasRows", () => {
  it("returns empty when no signals", () => {
    expect(computeBiasRows([], new Map())).toEqual([]);
  });

  it("skips signals with unknown interest keys", () => {
    const rows = computeBiasRows(
      [{ childId: "c1", interestKey: "not_a_real_interest" }],
      index([{ id: "c1", locale: "id", ageBand: "7-9" }]),
    );
    expect(rows).toEqual([]);
  });

  it("aggregates counts by locale and ageBand", () => {
    const rows = computeBiasRows(
      [
        { childId: "c1", interestKey: "art" },
        { childId: "c1", interestKey: "art" },
        { childId: "c2", interestKey: "art" },
      ],
      index([
        { id: "c1", locale: "id", ageBand: "7-9" },
        { id: "c2", locale: "en", ageBand: "10-12" },
      ]),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].totalSignals).toBe(3);
    expect(rows[0].byLocale).toEqual({ id: 2, en: 1 });
    expect(rows[0].dominantLocale).toBe("id");
    expect(rows[0].dominantLocaleShare).toBeCloseTo(2 / 3, 5);
  });
});

describe("flagBiasedInterests", () => {
  it("flags an interest with dominant locale and sufficient sample", () => {
    const rows = [
      {
        interestKey: "art",
        totalSignals: 30,
        byLocale: { id: 28, en: 2 },
        byAgeBand: { "7-9": 30 },
        dominantLocale: "id",
        dominantLocaleShare: 28 / 30,
      },
    ];
    expect(flagBiasedInterests(rows)).toEqual(["art"]);
  });

  it("does NOT flag when sample is below threshold", () => {
    const rows = [
      {
        interestKey: "art",
        totalSignals: 5,
        byLocale: { id: 5 },
        byAgeBand: { "7-9": 5 },
        dominantLocale: "id",
        dominantLocaleShare: 1,
      },
    ];
    expect(flagBiasedInterests(rows)).toEqual([]);
  });

  it("does NOT flag when locale share is below threshold", () => {
    const rows = [
      {
        interestKey: "music",
        totalSignals: 50,
        byLocale: { id: 25, en: 25 },
        byAgeBand: { "7-9": 50 },
        dominantLocale: "id",
        dominantLocaleShare: 0.5,
      },
    ];
    expect(flagBiasedInterests(rows)).toEqual([]);
  });
});
