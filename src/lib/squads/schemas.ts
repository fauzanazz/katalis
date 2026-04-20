/**
 * Zod schemas for the Squad Gallery 2.0 module.
 * Validates squad data, multi-tag classification, and squad detail responses.
 */

import { z } from "zod";

/** Single talent tag with confidence score */
export const TalentTagSchema = z.object({
  name: z.string().min(1),
  confidence: z.number().min(0).max(1),
});

export type TalentTag = z.infer<typeof TalentTagSchema>;

/** Squad summary (used in list views) */
export const SquadSummarySchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  theme: z.string().min(1),
  description: z.string().min(1),
  icon: z.string(),
  countries: z.array(z.string()),
  memberCount: z.number(),
  entryCount: z.number(),
  status: z.string(),
  featuredEntries: z.array(z.object({
    id: z.string(),
    imageUrl: z.string(),
    talentCategory: z.string(),
    country: z.string().nullable(),
  })).optional(),
});

export type SquadSummary = z.infer<typeof SquadSummarySchema>;

/** Squad detail with paginated entries */
export const SquadDetailSchema = SquadSummarySchema.extend({
  entries: z.array(z.object({
    id: z.string(),
    imageUrl: z.string(),
    talentCategory: z.string(),
    country: z.string().nullable(),
    questContext: z.unknown().nullable(),
    createdAt: z.string(),
  })),
});

export type SquadDetail = z.infer<typeof SquadDetailSchema>;

/** Multi-tag classification output */
export const MultiTagOutputSchema = z.object({
  tags: z.array(TalentTagSchema),
});

export type MultiTagOutput = z.infer<typeof MultiTagOutputSchema>;
