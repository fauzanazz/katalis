export const BASE_STEP = 0.04;

export type ZpdOutcome =
  | "completion"
  | "completion_strong_reflection"
  | "completion_with_frustration"
  | "abandoned"
  | "frustration_sustained";

export const OUTCOME_MULT: Record<ZpdOutcome, number> = {
  completion_strong_reflection: 1.0,
  completion: 0.6,
  completion_with_frustration: 0.2,
  abandoned: -0.5,
  frustration_sustained: -0.3,
};

function recencyWeight(daysSinceLastUpdate: number): number {
  if (daysSinceLastUpdate <= 1) return 1.2;
  if (daysSinceLastUpdate <= 7) return 1.0;
  if (daysSinceLastUpdate <= 30) return 0.8;
  return 0.6;
}

export function computeNextScore(
  current: number,
  outcome: ZpdOutcome,
  daysSinceLastUpdate: number,
): number {
  const delta =
    BASE_STEP * OUTCOME_MULT[outcome] * recencyWeight(daysSinceLastUpdate);
  return Math.max(0, Math.min(1, current + delta));
}
