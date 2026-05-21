import { isInterestSignalDimension, type InterestSignalDimension } from "./taxonomy";

export const DIMENSION_WEIGHTS: Record<InterestSignalDimension, number> = {
  engagement: 1.0,
  persistence: 1.15,
  joy: 1.1,
  curiosity: 1.05,
  independence: 1.0,
  repeat_request: 1.2,
  skill_growth: 1.0,
  frustration: -0.8,
};

export type ScoringSignal = {
  strength: number;
  confidence: number;
  dimension: InterestSignalDimension;
  observedAt: Date;
};

const DAY = 24 * 60 * 60 * 1000;

export function computeRecencyWeight(observedAt: Date, now: Date): number {
  const ageDays = (now.getTime() - observedAt.getTime()) / DAY;
  if (ageDays <= 7) return 1;
  if (ageDays <= 30) return 0.75;
  if (ageDays <= 90) return 0.5;
  return 0.25;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function dimensionWeight(dimension: InterestSignalDimension): number {
  const weight = DIMENSION_WEIGHTS[dimension];
  return Number.isFinite(weight) ? weight : 0;
}

export function computeInterestScore(signals: ScoringSignal[], now: Date): number {
  if (signals.length === 0) return 0;

  const sum = signals.reduce((acc, signal) => {
    if (!isInterestSignalDimension(signal.dimension)) return acc;
    const contribution =
      signal.strength *
      signal.confidence *
      dimensionWeight(signal.dimension) *
      computeRecencyWeight(signal.observedAt, now);
    return acc + contribution;
  }, 0);

  return clamp(sum, 0, 1);
}

export function computeTrend(
  signals: ScoringSignal[],
  now: Date,
): "rising" | "falling" | "stable" {
  const thirtyDaysAgo = new Date(now.getTime() - 30 * DAY);
  const sixtyDaysAgo = new Date(now.getTime() - 60 * DAY);

  const last30 = signals.filter((s) => s.observedAt >= thirtyDaysAgo);
  const prev30 = signals.filter(
    (s) => s.observedAt >= sixtyDaysAgo && s.observedAt < thirtyDaysAgo,
  );

  const last30Score = computeInterestScore(last30, now);
  const prev30Score = computeInterestScore(prev30, now);
  const diff = last30Score - prev30Score;

  if (diff > 0.15) return "rising";
  if (diff < -0.15) return "falling";
  return "stable";
}
