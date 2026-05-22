/**
 * Post-mission interest reassessment.
 *
 * Spec ref: Katalis.docx §6.2 — "After completing a mission, the system
 * should reassess: Did the child's engagement confirm or contradict the
 * interest prediction?"
 *
 * Strategy: combine completion (positive baseline) with negative signals
 * (frustration events, mission adjustments) to produce an engagement
 * multiplier and an optional `frustration` dimension signal. Predicted
 * interest signals from `mapMissionCompletionToInterestSignals` are scaled
 * accordingly before ingestion.
 */

import type { InterestSignalDimension } from "./taxonomy";

export interface MissionEngagementMetrics {
  /** True if mission was marked completed (vs abandoned). */
  completed: boolean;
  /** Count of `AdjustmentEvent` records issued during this mission. */
  adjustmentCount: number;
  /** Reflection sentiment if reflection was submitted: -1..1. */
  reflectionSentiment?: number;
  /** Frustration level peak observed during the mission. */
  peakFrustration?: "none" | "low" | "medium" | "high";
}

export interface MissionEngagementAssessment {
  /** Multiplier applied to each predicted interest signal's strength. 0..1.5 */
  engagementMultiplier: number;
  /** Whether to emit a counter-signal on the `frustration` dimension. */
  emitFrustrationSignal: boolean;
  /** Strength of the optional frustration signal. */
  frustrationStrength: number;
  /** Short label for audit logs. */
  label: "confirmed" | "partial" | "contradicted";
}

const FRUSTRATION_WEIGHT: Record<NonNullable<MissionEngagementMetrics["peakFrustration"]>, number> = {
  none: 0,
  low: 0.05,
  medium: 0.2,
  high: 0.4,
};

export function assessMissionEngagement(
  metrics: MissionEngagementMetrics,
): MissionEngagementAssessment {
  if (!metrics.completed) {
    return {
      engagementMultiplier: 0.2,
      emitFrustrationSignal: true,
      frustrationStrength: 0.6,
      label: "contradicted",
    };
  }

  const frustrationPenalty =
    FRUSTRATION_WEIGHT[metrics.peakFrustration ?? "none"] +
    Math.min(metrics.adjustmentCount * 0.1, 0.3);

  const sentimentBoost =
    typeof metrics.reflectionSentiment === "number"
      ? Math.max(metrics.reflectionSentiment, 0) * 0.25
      : 0;

  const multiplier = clamp(1.0 - frustrationPenalty + sentimentBoost, 0.2, 1.5);

  const emitFrustration = frustrationPenalty >= 0.3;
  const frustrationStrength = clamp(frustrationPenalty, 0, 1);

  let label: MissionEngagementAssessment["label"];
  if (multiplier >= 0.9) label = "confirmed";
  else if (multiplier >= 0.5) label = "partial";
  else label = "contradicted";

  return {
    engagementMultiplier: multiplier,
    emitFrustrationSignal: emitFrustration,
    frustrationStrength,
    label,
  };
}

export function applyAssessmentToSignals<
  T extends { strength: number; confidence: number; dimension: InterestSignalDimension; interestKey: string },
>(signals: T[], assessment: MissionEngagementAssessment): T[] {
  const scaled = signals.map((s) => ({
    ...s,
    strength: clamp(s.strength * assessment.engagementMultiplier, 0, 1),
  }));

  if (!assessment.emitFrustrationSignal) return scaled;

  const frustrationCounter = signals.map<T>((s) => ({
    ...s,
    dimension: "frustration" as InterestSignalDimension,
    strength: assessment.frustrationStrength,
    confidence: 0.5,
  }));

  return [...scaled, ...frustrationCounter];
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
