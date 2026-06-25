/**
 * Talent-development analytics for gallery entries ("tambah karya").
 *
 * A published gallery work is the visible output of a child's quest journey.
 * To measure whether Katalis is succeeding at *sparking talent*, every entry
 * captures a structured snapshot of that journey at completion time:
 * which talents were detected (and how strongly), how much effort the child
 * invested (missions + proof photos), how long they persisted, and the age
 * cohort they belong to.
 *
 * This module owns ONLY the pure derivation of those fields so the logic is
 * unit-testable in isolation. Serialization (JSON columns), persistence, AI
 * tag classification, and moderation live in the calling server function.
 */

import { getAgeGroup, type AgeGroup } from "@/lib/age";
import { geocodeLocationText } from "@/lib/geocoding";

const MS_PER_DAY = 1000 * 60 * 60 * 24;

export interface DetectedTalent {
  name: string;
  confidence: number;
}

export interface GalleryAnalyticsInput {
  /** Talents detected during Discovery, in any order. */
  detectedTalents: DetectedTalent[];
  /** Free-text local context used for coarse, country-level geocoding. */
  localContext: string | null | undefined;
  /** All missions of the quest (status + proof photo presence drive effort metrics). */
  missions: Array<{ status: string; proofPhotoUrl: string | null }>;
  /** When the quest was created — start of the journey. */
  questCreatedAt: Date;
  /** Child date of birth (coarse age-band cohort only; null when unknown). */
  childDateOfBirth: Date | null | undefined;
  /** Completion timestamp; defaults to now. */
  completedAt?: Date;
}

export interface GalleryAnalytics {
  /** Highest-confidence detected talent name, or "Creative" fallback. */
  talentCategory: string;
  /** Confidence (0..1) of the top talent, or null when none detected. */
  talentConfidence: number | null;
  /** Detected talents sorted by confidence descending. */
  detectedTalents: DetectedTalent[];
  /** Country-level location, or null. */
  country: string | null;
  /** `{ lat, lng }` when geocoding resolved, else null. */
  coordinates: { lat: number; lng: number } | null;
  /** Age-band cohort at completion ("3-6" | "7-9" | "10-12" | "unknown"). */
  ageBand: AgeGroup;
  /** Exact age in years at completion, or null when DoB unknown. */
  ageYears: number | null;
  /** Total missions in the quest (journey length). */
  missionCount: number;
  /** Missions completed (effort / follow-through). */
  completedMissionCount: number;
  /** Proof photos uploaded across the journey (effort / artifacts produced). */
  proofPhotoCount: number;
  /** Whole days from quest creation to completion (persistence). */
  questDurationDays: number;
}

/**
 * Derive the talent-development snapshot for a completed quest's gallery entry.
 * Pure: no DB, no network, no clock side effects beyond the injectable `completedAt`.
 */
export function buildGalleryAnalytics(input: GalleryAnalyticsInput): GalleryAnalytics {
  const completedAt = input.completedAt ?? new Date();

  const sortedTalents = [...input.detectedTalents].sort(
    (a, b) => (b.confidence ?? 0) - (a.confidence ?? 0),
  );
  const topTalent = sortedTalents[0];

  const geo = geocodeLocationText(input.localContext);

  const { band: ageBand, years: ageYears } = getAgeGroup(
    input.childDateOfBirth ?? null,
    completedAt,
  );

  const completedMissionCount = input.missions.filter(
    (mission) => mission.status === "completed",
  ).length;
  const proofPhotoCount = input.missions.filter(
    (mission) => mission.proofPhotoUrl,
  ).length;

  const elapsedMs = completedAt.getTime() - input.questCreatedAt.getTime();
  const questDurationDays = Math.max(0, Math.floor(elapsedMs / MS_PER_DAY));

  return {
    talentCategory: topTalent?.name ?? "Creative",
    talentConfidence: topTalent?.confidence ?? null,
    detectedTalents: sortedTalents,
    country: geo?.country ?? null,
    coordinates: geo?.coordinates ?? null,
    ageBand,
    ageYears,
    missionCount: input.missions.length,
    completedMissionCount,
    proofPhotoCount,
    questDurationDays,
  };
}
