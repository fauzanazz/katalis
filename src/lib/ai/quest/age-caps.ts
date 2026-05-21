/**
 * Per-age-band caps and prompt fragments for quest mission generation.
 *
 * Caps are upper bounds on `estimatedMinutes` for each daily mission. Younger
 * children get shorter missions; older children get longer ones. `unknown`
 * aliases the 7-9 baseline.
 *
 * Used by `/api/quest/generate` to:
 *  1. Inject a band-appropriate constraint sentence into the generation prompt.
 *  2. Validate the generated missions; reject (and retry once) if any mission
 *     exceeds the cap.
 */

import type { AgeGroup } from "@/lib/age";

export const MISSION_DURATION_CAPS: Record<AgeGroup, number> = {
  "3-6": 10,
  "7-9": 20,
  "10-12": 40,
  unknown: 20,
};

export function getMissionDurationCap(band: AgeGroup | null | undefined): number {
  if (!band) return MISSION_DURATION_CAPS.unknown;
  return MISSION_DURATION_CAPS[band] ?? MISSION_DURATION_CAPS.unknown;
}

const BAND_LABELS: Record<AgeGroup, string> = {
  "3-6": "a child aged 3 to 6 years",
  "7-9": "a child aged 7 to 9 years",
  "10-12": "a child aged 10 to 12 years",
  unknown: "a child aged 7 to 9 years (default range)",
};

export function buildAgeConstraintPromptFragment(
  band: AgeGroup | null | undefined,
): string {
  const resolved: AgeGroup = band ?? "unknown";
  const cap = getMissionDurationCap(resolved);
  const label = BAND_LABELS[resolved] ?? BAND_LABELS.unknown;
  return [
    `AGE CONSTRAINT: This 7-day quest is for ${label}.`,
    `Each daily mission MUST take ${cap} minutes or less to complete.`,
    `Include an "estimatedMinutes" field in each mission with an integer value between 1 and ${cap}.`,
    `Design materials, steps, and complexity to fit within this time budget.`,
  ].join(" ");
}

export interface CapCheckMissionInput {
  day: number;
  estimatedMinutes?: number;
  [key: string]: unknown;
}

export type CapCheckResult<T extends CapCheckMissionInput> =
  | { ok: true; missions: T[] }
  | { ok: false; reason: string; violatingDays: number[] };

export function clampOrRejectMissions<T extends CapCheckMissionInput>(
  missions: T[],
  band: AgeGroup | null | undefined,
): CapCheckResult<T> {
  const cap = getMissionDurationCap(band);
  const violatingDays: number[] = [];

  for (const m of missions) {
    if (typeof m.estimatedMinutes === "number" && m.estimatedMinutes > cap) {
      violatingDays.push(m.day);
    }
  }

  if (violatingDays.length === 0) {
    return { ok: true, missions };
  }

  return {
    ok: false,
    reason: `Missions on day(s) ${violatingDays.join(", ")} exceed the ${cap}-minute cap for this age band.`,
    violatingDays,
  };
}
