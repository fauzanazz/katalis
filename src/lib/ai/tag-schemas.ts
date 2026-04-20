/**
 * Zod schemas for multi-tag classification output.
 * AI classifies gallery entries into multiple semantic tags with confidence.
 */

import { z } from "zod";

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
