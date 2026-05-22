/**
 * Pure Cohen's Kappa primitives for the inter-rater reliability subsystem.
 * No I/O. See docs/plans/2026-05-22-reliability-kappa-design.md §6.
 */

import type {
  BinaryConfusion,
  ConfusedPair,
  MacroKappaOptions,
  MacroKappaResult,
  PerLabelKappa,
  RatingPair,
} from "./types";

interface BinaryObservation {
  ai: boolean;
  human: boolean;
}

/**
 * Cohen's Kappa for a stream of binary AI vs human observations.
 * Convention: if both raters always agree (p_o = 1), return 1 even though the
 * standard formula has a 0/0 in that degenerate case.
 */
export function binaryKappa(observations: BinaryObservation[]): number | null {
  if (observations.length === 0) return null;

  const n = observations.length;
  let agreeCount = 0;
  let aiPositive = 0;
  let humanPositive = 0;

  for (const obs of observations) {
    if (obs.ai === obs.human) agreeCount += 1;
    if (obs.ai) aiPositive += 1;
    if (obs.human) humanPositive += 1;
  }

  const observedAgreement = agreeCount / n;
  if (observedAgreement === 1) return 1;

  const pAi = aiPositive / n;
  const pHuman = humanPositive / n;
  const expectedAgreement = pAi * pHuman + (1 - pAi) * (1 - pHuman);

  if (expectedAgreement === 1) {
    // Reachable only when both sides always agree, which we already handled above
    // unless p_o < 1 — that's logically impossible. Defensive return.
    return 0;
  }

  return (observedAgreement - expectedAgreement) / (1 - expectedAgreement);
}

/** Build a per-label 2x2 confusion matrix across all items. */
export function confusionMatrix(
  domain: readonly string[],
  items: readonly RatingPair[],
): Record<string, BinaryConfusion> {
  const matrix: Record<string, BinaryConfusion> = {};
  for (const label of domain) {
    matrix[label] = {
      truePositive: 0,
      falsePositive: 0,
      falseNegative: 0,
      trueNegative: 0,
    };
  }
  for (const item of items) {
    for (const label of domain) {
      const ai = item.aiLabels.has(label);
      const human = item.humanLabels.has(label);
      const cell = matrix[label];
      if (ai && human) cell.truePositive += 1;
      else if (ai && !human) cell.falsePositive += 1;
      else if (!ai && human) cell.falseNegative += 1;
      else cell.trueNegative += 1;
    }
  }
  return matrix;
}

/**
 * Macro-averaged binary Cohen's Kappa across a fixed label domain. For each label,
 * compute binary Kappa over all items, then average across labels.
 *
 * By default, labels that neither AI nor human ever selected are skipped from the
 * average (they carry no information). Pass `strict: true` to include them as Kappa = 0.
 */
export function macroKappaMultiLabel(
  domain: readonly string[],
  items: readonly RatingPair[],
  opts: MacroKappaOptions = {},
): MacroKappaResult {
  const sampleSize = items.length;
  const topConfusedCount = opts.topConfusedCount ?? 5;

  if (sampleSize === 0) {
    return {
      kappa: null,
      sampleSize: 0,
      perLabel: [],
      skipped: [],
      topConfused: [],
    };
  }

  const matrix = confusionMatrix(domain, items);
  const perLabel: PerLabelKappa[] = [];
  const skipped: string[] = [];

  for (const label of domain) {
    const confusion = matrix[label];
    const support =
      confusion.truePositive + confusion.falsePositive + confusion.falseNegative;
    if (support === 0) {
      if (opts.strict) {
        perLabel.push({ label, kappa: 0, support: 0, confusion });
      } else {
        skipped.push(label);
      }
      continue;
    }
    const observations = items.map<BinaryObservation>((item) => ({
      ai: item.aiLabels.has(label),
      human: item.humanLabels.has(label),
    }));
    const k = binaryKappa(observations);
    perLabel.push({
      label,
      kappa: k ?? 0,
      support,
      confusion,
    });
  }

  const used = perLabel.length;
  const kappa =
    used === 0 ? null : perLabel.reduce((sum, p) => sum + p.kappa, 0) / used;

  return {
    kappa,
    sampleSize,
    perLabel,
    skipped,
    topConfused: topConfusedPairs(items, topConfusedCount),
  };
}

/**
 * Rank label pairs (aiLabel, humanLabel) by how often AI predicted aiLabel for an
 * item while human assigned humanLabel to the same item, and the two differ. The
 * pair is the cross product of (ai_only_labels x human_only_labels) per item.
 */
export function topConfusedPairs(
  items: readonly RatingPair[],
  n: number,
): ConfusedPair[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    const aiOnly: string[] = [];
    for (const ai of item.aiLabels) {
      if (!item.humanLabels.has(ai)) aiOnly.push(ai);
    }
    const humanOnly: string[] = [];
    for (const h of item.humanLabels) {
      if (!item.aiLabels.has(h)) humanOnly.push(h);
    }
    for (const a of aiOnly) {
      for (const h of humanOnly) {
        const key = `${a}|${h}`;
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }
  }
  const pairs: ConfusedPair[] = [];
  for (const [key, count] of counts) {
    const [aiLabel, humanLabel] = key.split("|");
    pairs.push({ aiLabel, humanLabel, count });
  }
  pairs.sort((a, b) => b.count - a.count);
  return pairs.slice(0, n);
}
