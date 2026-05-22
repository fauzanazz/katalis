/**
 * Zod schemas for multi-tag classification output.
 * AI classifies gallery entries into multiple semantic tags with confidence.
 */

import { z } from "zod";

/**
 * The eight broad tag categories the AI classifier emits, mirrored from the system prompt
 * in `src/lib/ai/tag-classifier.ts`. Reliability tooling (`src/lib/reliability`) compares
 * AI vs human labels over this fixed domain.
 */
export const TAG_CATEGORIES = [
  "Engineering",
  "Art",
  "Narrative",
  "Music",
  "Science",
  "Creative",
  "Leadership",
  "Empathy",
] as const;

export type TagCategory = (typeof TAG_CATEGORIES)[number];

const tagCategorySet = new Set<string>(TAG_CATEGORIES);

export function isTagCategory(value: string): value is TagCategory {
  return tagCategorySet.has(value);
}

export const ClassifiedTagSchema = z.object({
  name: z.string().min(1),
  confidence: z.number().min(0).max(1),
  category: z.string().min(1),
});

export type ClassifiedTag = z.infer<typeof ClassifiedTagSchema>;

export const TagClassificationOutputSchema = z.object({
  tags: z.array(ClassifiedTagSchema).min(1).max(5),
});

export type TagClassificationOutput = z.infer<typeof TagClassificationOutputSchema>;
