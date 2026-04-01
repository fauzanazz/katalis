/**
 * Zod schemas for AI analysis input and output validation.
 *
 * Input: { artifactUrl: string, artifactType: "image" | "audio" }
 * Output: { talents: Array<{ name: string, confidence: number, reasoning: string }> }
 */

import { z } from "zod";

/** Schema for the analysis request input */
export const AnalysisInputSchema = z.object({
  artifactUrl: z.string().min(1, "Artifact URL is required"),
  artifactType: z.enum(["image", "audio"], {
    message: "Artifact type must be 'image' or 'audio'",
  }),
});

export type AnalysisInput = z.infer<typeof AnalysisInputSchema>;

/** Schema for a single detected talent */
export const TalentSchema = z.object({
  name: z.string().min(1),
  confidence: z.number().min(0).max(1),
  reasoning: z.string().min(1),
});

export type Talent = z.infer<typeof TalentSchema>;

/** Schema for the full analysis response */
export const AnalysisOutputSchema = z.object({
  talents: z.array(TalentSchema).min(1, "At least one talent must be detected"),
});

export type AnalysisOutput = z.infer<typeof AnalysisOutputSchema>;
