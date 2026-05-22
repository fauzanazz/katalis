import { describe, expect, it } from "vitest";

import type { AgeGroup } from "@/lib/age";
import {
  MISSION_DURATION_CAPS,
  buildAgeConstraintPromptFragment,
  clampOrRejectMissions,
  getMissionDurationCap,
} from "./age-caps";

const ALL_BANDS: AgeGroup[] = ["3-6", "7-9", "10-12", "unknown"];

describe("MISSION_DURATION_CAPS", () => {
  it("defines cap for every AgeGroup", () => {
    for (const band of ALL_BANDS) {
      expect(MISSION_DURATION_CAPS[band], `band ${band}`).toBeTypeOf("number");
      expect(MISSION_DURATION_CAPS[band], `band ${band}`).toBeGreaterThan(0);
    }
  });

  it("3-6 < 7-9 < 10-12", () => {
    expect(MISSION_DURATION_CAPS["3-6"]).toBeLessThan(MISSION_DURATION_CAPS["7-9"]);
    expect(MISSION_DURATION_CAPS["7-9"]).toBeLessThan(MISSION_DURATION_CAPS["10-12"]);
  });

  it("unknown aliases 7-9 baseline", () => {
    expect(MISSION_DURATION_CAPS.unknown).toBe(MISSION_DURATION_CAPS["7-9"]);
  });

  it("matches spec values: 10 / 20 / 40", () => {
    expect(MISSION_DURATION_CAPS["3-6"]).toBe(10);
    expect(MISSION_DURATION_CAPS["7-9"]).toBe(20);
    expect(MISSION_DURATION_CAPS["10-12"]).toBe(40);
  });
});

describe("getMissionDurationCap", () => {
  it("returns cap per band", () => {
    for (const band of ALL_BANDS) {
      expect(getMissionDurationCap(band)).toBe(MISSION_DURATION_CAPS[band]);
    }
  });

  it("falls back to unknown for null/undefined", () => {
    expect(getMissionDurationCap(null)).toBe(MISSION_DURATION_CAPS.unknown);
    expect(getMissionDurationCap(undefined)).toBe(MISSION_DURATION_CAPS.unknown);
  });
});

describe("buildAgeConstraintPromptFragment", () => {
  it("contains the numeric cap", () => {
    for (const band of ALL_BANDS) {
      const fragment = buildAgeConstraintPromptFragment(band);
      expect(fragment, `band ${band}`).toContain(String(MISSION_DURATION_CAPS[band]));
    }
  });

  it("mentions the age band semantics for non-unknown bands", () => {
    expect(buildAgeConstraintPromptFragment("3-6")).toContain("3");
    expect(buildAgeConstraintPromptFragment("10-12")).toContain("12");
  });

  it("returns string for null/undefined fallback", () => {
    expect(buildAgeConstraintPromptFragment(null)).toContain(
      String(MISSION_DURATION_CAPS.unknown),
    );
  });
});

describe("clampOrRejectMissions", () => {
  function makeMissions(durations: Array<number | undefined>) {
    return durations.map((m, i) => ({
      day: i + 1,
      title: `Mission ${i + 1}`,
      estimatedMinutes: m,
    }));
  }

  it("accepts all missions when every estimatedMinutes is within cap", () => {
    const missions = makeMissions([5, 8, 10, 6, 9, 7, 5]);
    const result = clampOrRejectMissions(missions, "3-6");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.missions).toEqual(missions);
    }
  });

  it("accepts boundary value equal to cap", () => {
    const missions = makeMissions([10, 10, 10, 10, 10, 10, 10]);
    const result = clampOrRejectMissions(missions, "3-6");
    expect(result.ok).toBe(true);
  });

  it("rejects when any mission exceeds the cap", () => {
    const missions = makeMissions([5, 8, 60, 6, 9, 7, 5]);
    const result = clampOrRejectMissions(missions, "3-6");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/exceed/i);
      expect(result.violatingDays).toContain(3);
    }
  });

  it("accepts missions with undefined estimatedMinutes (treated as unknown duration, not violation)", () => {
    const missions = makeMissions([5, undefined, 8, undefined, 7, 6, 9]);
    const result = clampOrRejectMissions(missions, "3-6");
    expect(result.ok).toBe(true);
  });

  it("different bands have different acceptance thresholds for the same payload", () => {
    const missions = makeMissions([15, 18, 20, 16, 18, 17, 19]);
    expect(clampOrRejectMissions(missions, "3-6").ok).toBe(false);
    expect(clampOrRejectMissions(missions, "7-9").ok).toBe(true);
    expect(clampOrRejectMissions(missions, "10-12").ok).toBe(true);
  });
});
