/**
 * Zod schemas for AI gallery clustering input and output validation.
 *
 * Input: { entries: Array<{ id, talentCategory, country, coordinates }> }
 * Output: { clusters: Array<{ id, label, description, talentTheme, countries, entryIds }> }
 *
 * Claude groups gallery entries by talent category and geographic proximity,
 * generating meaningful, child-friendly cluster labels (e.g., "Robot Builders from Asia").
 */

import { z } from "zod";

/** Schema for a gallery entry passed to the clustering AI */
export const ClusterEntrySchema = z.object({
  id: z.string().min(1),
  talentCategory: z.string().min(1),
  country: z.string().nullable(),
  coordinates: z
    .object({
      lat: z.number(),
      lng: z.number(),
    })
    .nullable(),
});

export type ClusterEntry = z.infer<typeof ClusterEntrySchema>;

/** Schema for the clustering request input */
export const ClusteringInputSchema = z.object({
  entries: z.array(ClusterEntrySchema).min(1, "At least one entry is required"),
});

export type ClusteringInput = z.infer<typeof ClusteringInputSchema>;

/** Schema for a single cluster in the output */
export const ClusterSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  description: z.string().min(1),
  talentTheme: z.string().min(1),
  countries: z.array(z.string()),
  entryIds: z.array(z.string()).min(1),
});

export type Cluster = z.infer<typeof ClusterSchema>;

/** Schema for the full clustering response */
export const ClusteringOutputSchema = z.object({
  clusters: z.array(ClusterSchema).min(1, "At least one cluster must be generated"),
});

export type ClusteringOutput = z.infer<typeof ClusteringOutputSchema>;
