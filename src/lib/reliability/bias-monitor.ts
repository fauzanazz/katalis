/**
 * Bias monitoring for the interest detection pipeline.
 *
 * Spec ref: Katalis.docx §8.2 — surveillance for cultural/training-data bias,
 * gender bias, and socioeconomic bias in detection outputs.
 *
 * Approach: aggregate interest signal distributions by available proxies and
 * flag highly skewed assignments. We intentionally do NOT collect gender or
 * socioeconomic class on the child profile (privacy), so this module focuses
 * on what we CAN measure: locale (cultural proxy) and age band (developmental
 * stage). Skew metrics surface for human review; they do not auto-correct.
 *
 * Surface metrics:
 * - perInterest: counts and locale share for each interestKey
 * - perInterestPerLocale: full breakdown for the dashboard
 * - flaggedInterests: interestKeys where one locale exceeds DOMINANCE_THRESHOLD
 * - perInterestPerAgeBand: distribution by age band for sanity checks
 */

import { db } from "@/lib/db";
import { interestSignals, children } from "@/lib/schema";
import { getAgeGroup } from "@/lib/age";
import { isInterestKey } from "@/lib/interests/taxonomy";

export const LOCALE_DOMINANCE_THRESHOLD = 0.7;
export const BIAS_MIN_SIGNALS = 20;

export interface InterestBiasRow {
  interestKey: string;
  totalSignals: number;
  byLocale: Record<string, number>;
  byAgeBand: Record<string, number>;
  dominantLocale: string | null;
  dominantLocaleShare: number;
}

export interface BiasSnapshot {
  layer: "bias_monitor";
  generatedAt: string;
  sampleSize: number;
  perInterest: InterestBiasRow[];
  flaggedInterests: string[];
}

interface SignalRow {
  interestKey: string;
  childId: string;
}

interface ChildRow {
  id: string;
  locale: string;
  dateOfBirth: Date | null;
}

/**
 * Pure aggregation — separated for unit testing with synthetic inputs.
 */
export function computeBiasRows(
  signals: ReadonlyArray<SignalRow>,
  childIndex: ReadonlyMap<string, { locale: string; ageBand: string }>,
): InterestBiasRow[] {
  const groups = new Map<
    string,
    { byLocale: Map<string, number>; byAgeBand: Map<string, number>; total: number }
  >();

  for (const s of signals) {
    if (!isInterestKey(s.interestKey)) continue;
    const child = childIndex.get(s.childId);
    if (!child) continue;
    const group = groups.get(s.interestKey) ?? {
      byLocale: new Map(),
      byAgeBand: new Map(),
      total: 0,
    };
    group.byLocale.set(child.locale, (group.byLocale.get(child.locale) ?? 0) + 1);
    group.byAgeBand.set(child.ageBand, (group.byAgeBand.get(child.ageBand) ?? 0) + 1);
    group.total += 1;
    groups.set(s.interestKey, group);
  }

  const rows: InterestBiasRow[] = [];
  for (const [interestKey, group] of groups) {
    let dominantLocale: string | null = null;
    let dominantCount = 0;
    for (const [locale, count] of group.byLocale) {
      if (count > dominantCount) {
        dominantLocale = locale;
        dominantCount = count;
      }
    }
    rows.push({
      interestKey,
      totalSignals: group.total,
      byLocale: Object.fromEntries(group.byLocale),
      byAgeBand: Object.fromEntries(group.byAgeBand),
      dominantLocale,
      dominantLocaleShare: group.total === 0 ? 0 : dominantCount / group.total,
    });
  }
  rows.sort((a, b) => b.totalSignals - a.totalSignals);
  return rows;
}

export function flagBiasedInterests(rows: ReadonlyArray<InterestBiasRow>): string[] {
  return rows
    .filter(
      (r) => r.totalSignals >= BIAS_MIN_SIGNALS && r.dominantLocaleShare >= LOCALE_DOMINANCE_THRESHOLD,
    )
    .map((r) => r.interestKey);
}

export async function computeBiasSnapshot(): Promise<BiasSnapshot> {
  const signals = await db.query.interestSignals.findMany({
    columns: { interestKey: true, childId: true },
  }) as SignalRow[];

  const childRows = await db.query.children.findMany({
    columns: { id: true, locale: true, dateOfBirth: true },
  }) as ChildRow[];

  const childIndex = new Map<string, { locale: string; ageBand: string }>();
  for (const c of childRows) {
    childIndex.set(c.id, {
      locale: c.locale,
      ageBand: getAgeGroup(c.dateOfBirth).band,
    });
  }

  const perInterest = computeBiasRows(signals, childIndex);
  const flaggedInterests = flagBiasedInterests(perInterest);

  return {
    layer: "bias_monitor",
    generatedAt: new Date().toISOString(),
    sampleSize: signals.length,
    perInterest,
    flaggedInterests,
  };
}
