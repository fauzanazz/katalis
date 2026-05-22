/**
 * KidsArtBench 9-dimensional artwork scoring rubric.
 *
 * Spec ref: Katalis.docx §1.2 — "The 9-dimensional scoring system (structure,
 * color, detail, spatial, logic, etc.) aligns well with Gardner's intelligence
 * dimensions."
 *
 * Source: Mingrui Ye et al., "KidsArtBench: Multi-Dimensional Children's Art
 * Evaluation with Attribute-Aware MLLMs." arXiv 2025.
 *
 * Each dimension is scored 0..1 where 0 = absent / weak and 1 = clearly
 * developed for the child's age band. The score is descriptive, not
 * normative — it is intended for trend tracking and Gardner mapping, not for
 * ranking children.
 */

import { z } from "zod";

export const KIDSART_BENCH_DIMENSIONS = [
  "structure",
  "color",
  "detail",
  "spatial",
  "logic",
  "composition",
  "originality",
  "narrative",
  "technique",
] as const;

export type KidsArtBenchDimension = (typeof KIDSART_BENCH_DIMENSIONS)[number];

export const KIDSART_BENCH_DESCRIPTIONS: Record<KidsArtBenchDimension, string> = {
  structure: "Overall visual organization — balance, weight distribution, framing.",
  color: "Use and harmony of color: variety, intentional contrast, palette coherence.",
  detail: "Fine-grained observation captured in the work (textures, parts, features).",
  spatial: "Depth, perspective, scale, and spatial relationships between objects.",
  logic: "Internal consistency — cause/effect, physical plausibility within the world depicted.",
  composition: "Layout, focal point handling, use of negative space and visual rhythm.",
  originality: "Creative novelty vs. learned templates; unexpected ideas or combinations.",
  narrative: "Presence of story, sequence, or implied action across the image/recording.",
  technique: "Motor execution — line control, brushwork, pressure, rendering choices.",
};

export const KidsArtBenchScoreSchema = z.object({
  structure: z.number().min(0).max(1),
  color: z.number().min(0).max(1),
  detail: z.number().min(0).max(1),
  spatial: z.number().min(0).max(1),
  logic: z.number().min(0).max(1),
  composition: z.number().min(0).max(1),
  originality: z.number().min(0).max(1),
  narrative: z.number().min(0).max(1),
  technique: z.number().min(0).max(1),
});

export type KidsArtBenchScore = z.infer<typeof KidsArtBenchScoreSchema>;

/**
 * Gardner Multiple Intelligences mapping. Each KidsArtBench dimension maps to
 * one or more Gardner intelligences for cross-reporting in parent dashboards.
 *
 * Spec ref: Katalis.docx §1.2 — "aligns well with Gardner's intelligence
 * dimensions."
 */
export const GARDNER_MAPPING: Record<KidsArtBenchDimension, string[]> = {
  structure: ["spatial", "logical_mathematical"],
  color: ["visual_arts", "naturalist"],
  detail: ["naturalist", "intrapersonal"],
  spatial: ["spatial", "bodily_kinesthetic"],
  logic: ["logical_mathematical"],
  composition: ["spatial", "visual_arts"],
  originality: ["intrapersonal", "linguistic"],
  narrative: ["linguistic", "interpersonal"],
  technique: ["bodily_kinesthetic", "visual_arts"],
};

/**
 * Aggregate the 9 dimensions into Gardner-intelligence-level scores by
 * averaging the contributing dimensions.
 */
export function mapToGardner(score: KidsArtBenchScore): Record<string, number> {
  const tallies = new Map<string, { sum: number; count: number }>();
  for (const dim of KIDSART_BENCH_DIMENSIONS) {
    const value = score[dim];
    for (const intelligence of GARDNER_MAPPING[dim]) {
      const t = tallies.get(intelligence) ?? { sum: 0, count: 0 };
      t.sum += value;
      t.count += 1;
      tallies.set(intelligence, t);
    }
  }
  const result: Record<string, number> = {};
  for (const [intelligence, t] of tallies) {
    result[intelligence] = t.count > 0 ? t.sum / t.count : 0;
  }
  return result;
}

/**
 * Helper for tests/mocks — fills any missing dimensions with the given
 * default. Useful when a provider returns partial scores.
 */
export function completeScore(
  partial: Partial<KidsArtBenchScore>,
  fallback = 0.5,
): KidsArtBenchScore {
  return {
    structure: partial.structure ?? fallback,
    color: partial.color ?? fallback,
    detail: partial.detail ?? fallback,
    spatial: partial.spatial ?? fallback,
    logic: partial.logic ?? fallback,
    composition: partial.composition ?? fallback,
    originality: partial.originality ?? fallback,
    narrative: partial.narrative ?? fallback,
    technique: partial.technique ?? fallback,
  };
}
