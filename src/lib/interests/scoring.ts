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

/**
 * Half-life (days) of an interest signal's contribution under exponential
 * decay. After RECENCY_HALF_LIFE_DAYS the signal contributes half. Spec ref:
 * Katalis.docx §6.1c — "Use exponential moving average (EMA) to balance
 * historical data and new observations."
 */
export const RECENCY_HALF_LIFE_DAYS = 21;
const RECENCY_LAMBDA = Math.LN2 / RECENCY_HALF_LIFE_DAYS;

/**
 * Exponential decay recency weight. weight(t) = 0.5^(ageDays / half-life).
 * Replaces the previous bin-based weighting (1.0 / 0.75 / 0.5 / 0.25).
 *
 * Spot-check values (half-life = 21d): 0d → 1.0, 7d → 0.79, 21d → 0.5,
 * 42d → 0.25, 63d → 0.125.
 */
export function computeRecencyWeight(observedAt: Date, now: Date): number {
  const ageDays = Math.max(0, (now.getTime() - observedAt.getTime()) / DAY);
  return Math.exp(-RECENCY_LAMBDA * ageDays);
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

/**
 * Classify an interest's persistence based on observation history.
 *
 * - `fleeting` — single observation, or all observations within one day
 * - `emerging` — multiple sessions but span < 14 days
 * - `sustained` — ≥3 distinct days AND span ≥14 days
 *
 * Spec ref: Katalis.docx §6.1 — "Distinguish between fleeting interests
 * (appear once) and sustained interests (appear across multiple
 * sessions/weeks)."
 */
export type InterestStability = "fleeting" | "emerging" | "sustained";

export function computeStability(
  observations: Date[],
  now: Date,
): InterestStability {
  if (observations.length === 0) return "fleeting";

  const dayIndices = new Set<number>();
  let earliest = observations[0].getTime();
  for (const obs of observations) {
    const t = obs.getTime();
    if (t < earliest) earliest = t;
    dayIndices.add(Math.floor(t / DAY));
  }

  const distinctDays = dayIndices.size;
  if (distinctDays < 2) return "fleeting";

  const spanDays = (now.getTime() - earliest) / DAY;
  if (distinctDays >= 3 && spanDays >= 14) return "sustained";

  return "emerging";
}

/**
 * Count distinct calendar days (UTC) covered by the observation set.
 * Used to populate ChildInterestProfile.distinctDays.
 */
export function countDistinctDays(observations: Date[]): number {
  const days = new Set<number>();
  for (const o of observations) days.add(Math.floor(o.getTime() / DAY));
  return days.size;
}
