import { describe, expect, it } from "vitest";

import type { AgeGroup } from "@/lib/age";
import {
  FRUSTRATION_THRESHOLDS,
  MENTOR_PROMPTS,
  getFrustrationThresholds,
  getMentorSystemPrompt,
} from "./age-config";

const ALL_BANDS: AgeGroup[] = ["3-6", "7-9", "10-12", "unknown"];

describe("MENTOR_PROMPTS", () => {
  it("defines a non-empty prompt for every AgeGroup", () => {
    for (const band of ALL_BANDS) {
      expect(MENTOR_PROMPTS[band], `band ${band}`).toBeTypeOf("string");
      expect(MENTOR_PROMPTS[band].length, `band ${band}`).toBeGreaterThan(50);
    }
  });

  it("uses unknown as alias for 7-9 baseline (preserves current behavior)", () => {
    expect(MENTOR_PROMPTS.unknown).toBe(MENTOR_PROMPTS["7-9"]);
  });

  it("produces distinct prompts for 3-6 vs 10-12", () => {
    expect(MENTOR_PROMPTS["3-6"]).not.toBe(MENTOR_PROMPTS["10-12"]);
  });

  it("preserves Socratic core rules in every band", () => {
    for (const band of ALL_BANDS) {
      const prompt = MENTOR_PROMPTS[band];
      expect(prompt, `band ${band} should forbid fail-language`).toContain("NEVER say:");
      for (const banned of ['"fail"', '"wrong"', '"mistake"']) {
        expect(prompt, `band ${band} should ban ${banned}`).toContain(banned);
      }
      expect(prompt, `band ${band} should mandate Small Adjustment language`).toContain(
        "small adjustment",
      );
    }
  });
});

describe("getMentorSystemPrompt", () => {
  it("returns the band-specific prompt", () => {
    for (const band of ALL_BANDS) {
      expect(getMentorSystemPrompt(band)).toBe(MENTOR_PROMPTS[band]);
    }
  });

  it("falls back to unknown for null/undefined input", () => {
    expect(getMentorSystemPrompt(undefined)).toBe(MENTOR_PROMPTS.unknown);
    expect(getMentorSystemPrompt(null)).toBe(MENTOR_PROMPTS.unknown);
  });
});

describe("FRUSTRATION_THRESHOLDS", () => {
  it("defines thresholds for every AgeGroup", () => {
    for (const band of ALL_BANDS) {
      const t = FRUSTRATION_THRESHOLDS[band];
      expect(t, `band ${band}`).toBeDefined();
      expect(t.messageCountMedium).toBeTypeOf("number");
      expect(t.messageCountHigh).toBeTypeOf("number");
      expect(t.durationMedium).toBeTypeOf("number");
      expect(t.durationHigh).toBeTypeOf("number");
      expect(t.keywordCountMedium).toBeTypeOf("number");
      expect(t.keywordCountHigh).toBeTypeOf("number");
    }
  });

  it("medium threshold is strictly less than high within each band", () => {
    for (const band of ALL_BANDS) {
      const t = FRUSTRATION_THRESHOLDS[band];
      expect(t.messageCountMedium, `band ${band} msg`).toBeLessThan(t.messageCountHigh);
      expect(t.durationMedium, `band ${band} dur`).toBeLessThan(t.durationHigh);
      expect(t.keywordCountMedium, `band ${band} kw`).toBeLessThan(t.keywordCountHigh);
    }
  });

  it("younger bands trigger frustration sooner than older bands", () => {
    expect(FRUSTRATION_THRESHOLDS["3-6"].messageCountMedium).toBeLessThan(
      FRUSTRATION_THRESHOLDS["10-12"].messageCountMedium,
    );
    expect(FRUSTRATION_THRESHOLDS["3-6"].durationMedium).toBeLessThan(
      FRUSTRATION_THRESHOLDS["10-12"].durationMedium,
    );
    expect(FRUSTRATION_THRESHOLDS["3-6"].keywordCountMedium).toBeLessThanOrEqual(
      FRUSTRATION_THRESHOLDS["10-12"].keywordCountMedium,
    );
  });

  it("unknown band aliases 7-9 baseline", () => {
    expect(FRUSTRATION_THRESHOLDS.unknown).toEqual(FRUSTRATION_THRESHOLDS["7-9"]);
  });
});

describe("getFrustrationThresholds", () => {
  it("returns the band-specific thresholds", () => {
    for (const band of ALL_BANDS) {
      expect(getFrustrationThresholds(band)).toBe(FRUSTRATION_THRESHOLDS[band]);
    }
  });

  it("falls back to unknown for null/undefined", () => {
    expect(getFrustrationThresholds(undefined)).toBe(FRUSTRATION_THRESHOLDS.unknown);
    expect(getFrustrationThresholds(null)).toBe(FRUSTRATION_THRESHOLDS.unknown);
  });
});
