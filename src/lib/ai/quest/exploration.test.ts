import { describe, expect, it } from "vitest";

import { pickExplorationInterests, shouldIncludeExploration } from "./exploration";

describe("pickExplorationInterests", () => {
  it("returns empty array when no profile yet", () => {
    expect(pickExplorationInterests([])).toEqual([]);
  });

  it("prefers low-scored profile rows over untouched taxonomy keys", () => {
    const result = pickExplorationInterests(
      [
        { interestKey: "art", score: 0.9 },
        { interestKey: "music", score: 0.85 },
        { interestKey: "building", score: 0.8 },
        { interestKey: "science", score: 0.1 }, // low-scored — exploration target
      ],
      3,
      1,
    );
    expect(result).toEqual(["science"]);
  });

  it("falls back to untouched taxonomy keys when low profile is empty", () => {
    const result = pickExplorationInterests(
      [
        { interestKey: "art", score: 0.9 },
        { interestKey: "music", score: 0.85 },
        { interestKey: "building", score: 0.8 },
      ],
      3,
      2,
    );
    expect(result).toHaveLength(2);
    expect(result).not.toContain("art");
    expect(result).not.toContain("music");
    expect(result).not.toContain("building");
  });

  it("excludes top N interests from the candidates", () => {
    const top3 = ["art", "music", "building"] as const;
    const result = pickExplorationInterests(
      top3.map((key) => ({ interestKey: key, score: 1 })),
      3,
      4,
    );
    for (const k of top3) expect(result).not.toContain(k);
  });
});

describe("shouldIncludeExploration", () => {
  it("returns false when profile too sparse", () => {
    expect(shouldIncludeExploration([{ interestKey: "art", score: 0.5 }])).toBe(false);
  });

  it("returns true when profile has at least topN rows", () => {
    expect(
      shouldIncludeExploration(
        [
          { interestKey: "art", score: 0.5 },
          { interestKey: "music", score: 0.5 },
          { interestKey: "building", score: 0.5 },
        ],
        3,
      ),
    ).toBe(true);
  });
});
