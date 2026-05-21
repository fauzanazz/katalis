/**
 * Age stratification primitives.
 *
 * Bands map a child's calendar age to a developmental policy bucket used by
 * Discover, Quest Buddy mentor, and Mission generator. Bands and policies are
 * defined in domain modules; this module only owns the band mapping function.
 *
 * `unknown` is returned for null/undefined DoB, future DoB, and ages outside
 * 3–12. Domain consumers map `unknown` to a documented baseline policy.
 */

export type AgeGroup = "3-6" | "7-9" | "10-12" | "unknown";

export const AGE_BANDS = {
  "3-6": { min: 3, max: 6 },
  "7-9": { min: 7, max: 9 },
  "10-12": { min: 10, max: 12 },
} as const;

export type AgeResult = { band: AgeGroup; years: number | null };

export function getAgeGroup(
  dob: Date | null | undefined,
  now: Date = new Date(),
): AgeResult {
  if (!dob) return { band: "unknown", years: null };
  if (dob.getTime() > now.getTime()) return { band: "unknown", years: null };

  const years = computeYears(dob, now);
  return { band: bandFor(years), years };
}

function computeYears(dob: Date, now: Date): number {
  let years = now.getUTCFullYear() - dob.getUTCFullYear();
  const monthDiff = now.getUTCMonth() - dob.getUTCMonth();
  const dayDiff = now.getUTCDate() - dob.getUTCDate();
  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) years--;
  return years;
}

function bandFor(years: number): AgeGroup {
  for (const [band, range] of Object.entries(AGE_BANDS) as Array<
    [Exclude<AgeGroup, "unknown">, { min: number; max: number }]
  >) {
    if (years >= range.min && years <= range.max) return band;
  }
  return "unknown";
}
