export type ZpdPhase = "high" | "medium" | "low";

export function dayToPhase(day: number): ZpdPhase {
  if (day < 1 || day > 7 || !Number.isInteger(day)) {
    throw new Error(`dayToPhase: day must be an integer in [1,7], got ${day}`);
  }
  if (day <= 2) return "high";
  if (day <= 5) return "medium";
  return "low";
}

const PHASE_OFFSET: Record<ZpdPhase, number> = {
  high: 0.15,
  medium: 0.05,
  low: -0.1,
};

export function phaseIntensityAnchor(score: number, phase: ZpdPhase): number {
  const raw = score + PHASE_OFFSET[phase];
  return Math.max(0, Math.min(1, raw));
}
