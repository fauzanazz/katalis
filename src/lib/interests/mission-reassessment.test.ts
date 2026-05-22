import { describe, expect, it } from "vitest";

import {
  applyAssessmentToSignals,
  assessMissionEngagement,
} from "./mission-reassessment";

describe("assessMissionEngagement", () => {
  it("returns 'confirmed' when no frustration and no adjustments", () => {
    const r = assessMissionEngagement({ completed: true, adjustmentCount: 0 });
    expect(r.label).toBe("confirmed");
    expect(r.engagementMultiplier).toBe(1);
    expect(r.emitFrustrationSignal).toBe(false);
  });

  it("returns 'contradicted' when mission abandoned", () => {
    const r = assessMissionEngagement({ completed: false, adjustmentCount: 0 });
    expect(r.label).toBe("contradicted");
    expect(r.engagementMultiplier).toBeLessThan(0.6);
    expect(r.emitFrustrationSignal).toBe(true);
  });

  it("returns 'partial' when high frustration but completed", () => {
    const r = assessMissionEngagement({
      completed: true,
      adjustmentCount: 1,
      peakFrustration: "high",
    });
    expect(r.label).toBe("partial");
    expect(r.engagementMultiplier).toBeLessThan(1);
    expect(r.emitFrustrationSignal).toBe(true);
  });

  it("positive reflection sentiment boosts multiplier", () => {
    const neutral = assessMissionEngagement({
      completed: true,
      adjustmentCount: 0,
    });
    const happy = assessMissionEngagement({
      completed: true,
      adjustmentCount: 0,
      reflectionSentiment: 1,
    });
    expect(happy.engagementMultiplier).toBeGreaterThan(neutral.engagementMultiplier);
  });

  it("negative reflection sentiment doesn't add bonus (clamped at 0)", () => {
    const r = assessMissionEngagement({
      completed: true,
      adjustmentCount: 0,
      reflectionSentiment: -0.5,
    });
    expect(r.engagementMultiplier).toBe(1); // 1.0 + 0 + 0 = 1
  });
});

describe("applyAssessmentToSignals", () => {
  const baseSignal = {
    interestKey: "art",
    dimension: "engagement" as const,
    strength: 0.6,
    confidence: 0.7,
  };

  it("scales strength by engagementMultiplier", () => {
    const result = applyAssessmentToSignals([baseSignal], {
      engagementMultiplier: 0.5,
      emitFrustrationSignal: false,
      frustrationStrength: 0,
      label: "partial",
    });
    expect(result).toHaveLength(1);
    expect(result[0].strength).toBeCloseTo(0.3);
  });

  it("appends frustration counter-signals when emitFrustrationSignal", () => {
    const result = applyAssessmentToSignals([baseSignal], {
      engagementMultiplier: 0.4,
      emitFrustrationSignal: true,
      frustrationStrength: 0.5,
      label: "contradicted",
    });
    expect(result).toHaveLength(2);
    expect(result[1].dimension).toBe("frustration");
    expect(result[1].strength).toBe(0.5);
    expect(result[1].interestKey).toBe("art");
  });

  it("returns empty array when no signals provided", () => {
    const result = applyAssessmentToSignals([], {
      engagementMultiplier: 1,
      emitFrustrationSignal: true,
      frustrationStrength: 0.5,
      label: "confirmed",
    });
    expect(result).toEqual([]);
  });
});
