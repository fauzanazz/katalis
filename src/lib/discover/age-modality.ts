/**
 * Allowed Discover input modalities per age band.
 *
 * - 3-6: photo only (drawing upload). Pre-readers; voice-recording UX not
 *   reliable at this stage.
 * - 7-9: photo + voice. Voice transcription bridges literacy gap.
 * - 10-12: photo + voice + text/story prompt.
 * - unknown: aliases 7-9 baseline.
 *
 * Enforcement is defense-in-depth: UI hides/disables disallowed inputs AND
 * server-side rejects payloads with HTTP 400 `modality_not_allowed_for_age`.
 */

import type { AgeGroup } from "@/lib/age";
import { getAgeGroup } from "@/lib/age";

export const MODALITY_LIST = ["photo", "voice", "text"] as const;
export type Modality = (typeof MODALITY_LIST)[number];

export const ALLOWED_MODALITIES: Record<AgeGroup, Modality[]> = {
  "3-6": ["photo"],
  "7-9": ["photo", "voice"],
  "10-12": ["photo", "voice", "text"],
  unknown: ["photo", "voice"],
};

export function isModalityAllowed(
  band: AgeGroup | null | undefined,
  modality: Modality,
): boolean {
  const resolved: AgeGroup = band ?? "unknown";
  const allowed = ALLOWED_MODALITIES[resolved] ?? ALLOWED_MODALITIES.unknown;
  return allowed.includes(modality);
}

/**
 * Map a discovery artifactType to the corresponding age-band Modality.
 * `image` → `photo`; `audio` → `voice`; story prompt route → caller passes
 * `text` directly.
 */
export function modalityFromArtifactType(
  artifactType: "image" | "audio",
): Modality {
  return artifactType === "image" ? "photo" : "voice";
}

/**
 * Resolve a child's age band from a Date-of-Birth value. Convenience for API
 * routes that have already fetched `Child.dateOfBirth` and just need the band.
 */
export function bandForDob(dob: Date | null | undefined): AgeGroup {
  return getAgeGroup(dob).band;
}
