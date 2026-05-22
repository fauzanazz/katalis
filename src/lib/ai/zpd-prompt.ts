import { dayToPhase, phaseIntensityAnchor, type ZpdPhase } from "@/lib/zpd";
import type { QuestGenerationOutput } from "./quest-schemas";

const DEFAULT_BASELINE = 0.3;

const PHASE_INTENT: Record<ZpdPhase, string> = {
  high: "stretch",
  medium: "stabilize",
  low: "consolidate",
};

export function buildZpdPromptBlock(zpdScore?: number): string {
  const score = zpdScore ?? DEFAULT_BASELINE;
  const lines = [1, 2, 3, 4, 5, 6, 7].map((day) => {
    const phase = dayToPhase(day);
    const anchor = phaseIntensityAnchor(score, phase);
    return `- Day ${day} (phase=${phase}, intent=${PHASE_INTENT[phase]}, intensityHint=${anchor.toFixed(2)})`;
  });

  return [
    "",
    "**ZPD Calibration (per-day challenge level):**",
    `Current capability anchor: ${score.toFixed(2)} (0=easiest, 1=hardest).`,
    "Each day's task must match its phase:",
    "  high  → push beyond current capability",
    "  medium → stabilize and practice at current level",
    "  low   → consolidate and showcase what was learned",
    "",
    ...lines,
    "",
    "Return phase, intensityHint, and intent on each mission day matching this calibration.",
  ].join("\n");
}

export function fillPhaseMetadata(
  output: QuestGenerationOutput,
  zpdScore?: number,
): QuestGenerationOutput {
  const score = zpdScore ?? DEFAULT_BASELINE;
  return {
    missions: output.missions.map((mission) => {
      const phase: ZpdPhase = mission.phase ?? dayToPhase(mission.day);
      const intensityHint =
        mission.intensityHint ?? phaseIntensityAnchor(score, phase);
      const intent = mission.intent ?? PHASE_INTENT[phase];
      return { ...mission, phase, intensityHint, intent };
    }),
  };
}
