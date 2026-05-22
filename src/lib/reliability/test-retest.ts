/**
 * Test-Retest Reliability for Discovery interest detection.
 *
 * Spec ref: Katalis.docx §1.3a — "Have the same child submit works at
 * different times; the interest tags should show >70% consistency."
 *
 * Strategy: pair-wise Jaccard similarity between each child's discovery tag
 * sets within a configurable window. We compute a cohort-level consistency
 * (mean child consistency) and per-child rows for the admin dashboard.
 *
 * Tags compared: `detectedTalents` category strings, deduplicated.
 */

import { prisma } from "@/lib/db";

export const TEST_RETEST_THRESHOLD = 0.7;
export const TEST_RETEST_WINDOW_DAYS = 30;
export const TEST_RETEST_MIN_PAIRS = 1;
export const TEST_RETEST_MIN_GAP_HOURS = 6;

export interface PerChildConsistency {
  childId: string;
  pairCount: number;
  meanJaccard: number;
}

export interface TestRetestSnapshot {
  layer: "test_retest";
  cohortConsistency: number | null;
  childCount: number;
  pairCount: number;
  childrenBelowThreshold: number;
  perChild: PerChildConsistency[];
}

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

export function jaccardSimilarity(a: ReadonlySet<string>, b: ReadonlySet<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let intersection = 0;
  for (const v of a) if (b.has(v)) intersection += 1;
  const union = a.size + b.size - intersection;
  if (union === 0) return 1;
  return intersection / union;
}

interface RawDiscoveryRow {
  childId: string;
  createdAt: Date;
  detectedTalents: string | null;
}

function extractCategories(detectedTalents: string | null): Set<string> {
  if (!detectedTalents) return new Set();
  try {
    const parsed = JSON.parse(detectedTalents);
    if (!Array.isArray(parsed)) return new Set();
    const out = new Set<string>();
    for (const t of parsed) {
      if (!t || typeof t !== "object") continue;
      if (typeof t.category === "string") {
        out.add(t.category);
      } else if (typeof t.name === "string") {
        out.add(t.name);
      }
    }
    return out;
  } catch {
    return new Set();
  }
}

export function computeChildConsistency(
  rows: ReadonlyArray<RawDiscoveryRow>,
  windowDays = TEST_RETEST_WINDOW_DAYS,
  minGapHours = TEST_RETEST_MIN_GAP_HOURS,
): { pairCount: number; meanJaccard: number } {
  const sorted = [...rows].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const windowMs = windowDays * DAY;
  const minGapMs = minGapHours * HOUR;

  let pairCount = 0;
  let sumJaccard = 0;

  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      const dt = sorted[j].createdAt.getTime() - sorted[i].createdAt.getTime();
      if (dt < minGapMs) continue;
      if (dt > windowMs) break;
      const tagsA = extractCategories(sorted[i].detectedTalents);
      const tagsB = extractCategories(sorted[j].detectedTalents);
      if (tagsA.size === 0 && tagsB.size === 0) continue;
      pairCount += 1;
      sumJaccard += jaccardSimilarity(tagsA, tagsB);
    }
  }

  return {
    pairCount,
    meanJaccard: pairCount === 0 ? 0 : sumJaccard / pairCount,
  };
}

export async function computeTestRetestSnapshot(): Promise<TestRetestSnapshot> {
  const rows = (await prisma.discovery.findMany({
    select: {
      childId: true,
      createdAt: true,
      detectedTalents: true,
    },
    where: { detectedTalents: { not: null } },
  })) as RawDiscoveryRow[];

  const byChild = new Map<string, RawDiscoveryRow[]>();
  for (const row of rows) {
    const list = byChild.get(row.childId) ?? [];
    list.push(row);
    byChild.set(row.childId, list);
  }

  const perChild: PerChildConsistency[] = [];
  let totalPairs = 0;
  let weightedSum = 0;

  for (const [childId, childRows] of byChild) {
    if (childRows.length < 2) continue;
    const stats = computeChildConsistency(childRows);
    if (stats.pairCount < TEST_RETEST_MIN_PAIRS) continue;
    perChild.push({
      childId,
      pairCount: stats.pairCount,
      meanJaccard: stats.meanJaccard,
    });
    totalPairs += stats.pairCount;
    weightedSum += stats.meanJaccard * stats.pairCount;
  }

  const cohortConsistency = totalPairs === 0 ? null : weightedSum / totalPairs;
  const childrenBelowThreshold = perChild.filter(
    (c) => c.meanJaccard < TEST_RETEST_THRESHOLD,
  ).length;

  return {
    layer: "test_retest",
    cohortConsistency,
    childCount: perChild.length,
    pairCount: totalPairs,
    childrenBelowThreshold,
    perChild,
  };
}
