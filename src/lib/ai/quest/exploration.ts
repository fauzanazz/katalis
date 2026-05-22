/**
 * Pygmalion safeguard: pick exploration interest hints that fall OUTSIDE the
 * child's current top interests, so the quest generator inserts at least one
 * mission in a new domain.
 *
 * Spec ref: Katalis.docx §8.1 — "Periodically suggest 'exploration missions'
 * in areas outside the child's current top interests."
 *
 * Pure helper: no DB access here so the caller can plug in any source for the
 * profile snapshot (tests, services, routes, etc.).
 */

import { INTEREST_TAXONOMY_V1, type InterestKey } from "@/lib/interests/taxonomy";

export interface ProfileSummary {
  interestKey: InterestKey;
  score: number;
}

/**
 * Pick up to `limit` interest keys that are NOT among the child's top
 * interests. Returns an empty array when the child has no profile yet
 * (fresh-start case: the discovery flow drives initial signals).
 *
 * Deterministic selection: lowest-score-first from non-top interests, then
 * untouched taxonomy keys to fill the slot.
 */
export function pickExplorationInterests(
  profiles: ReadonlyArray<ProfileSummary>,
  topN = 3,
  limit = 2,
): InterestKey[] {
  if (profiles.length === 0) return [];

  const sorted = [...profiles].sort((a, b) => b.score - a.score);
  const top = new Set<string>(sorted.slice(0, topN).map((p) => p.interestKey));

  const candidates: InterestKey[] = [];

  // Underweighted profile rows (already seen but low signal) — prefer these
  // first so we revisit interests the child briefly touched.
  const lowProfile = sorted.slice(topN).map((p) => p.interestKey);
  for (const key of lowProfile) {
    if (candidates.length >= limit) break;
    candidates.push(key);
  }

  // Then taxonomy keys never seen — true exploration.
  for (const key of INTEREST_TAXONOMY_V1) {
    if (candidates.length >= limit) break;
    if (top.has(key) || candidates.includes(key)) continue;
    candidates.push(key);
  }

  return candidates;
}

/**
 * Decide whether the next quest should include an exploration mission.
 * Currently: include when the child has ≥`topN` profile rows (i.e. their
 * top set is somewhat established).
 */
export function shouldIncludeExploration(
  profiles: ReadonlyArray<ProfileSummary>,
  topN = 3,
): boolean {
  return profiles.length >= topN;
}
