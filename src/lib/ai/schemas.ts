/**
 * Zod schemas for AI analysis input and output validation.
 *
 * Input: { artifactUrl: string, artifactType: "image" | "audio" }
 * Output: { talents: Array<{ name: string, confidence: number, reasoning: string }> }
 */

import { z } from "zod";

import { KidsArtBenchScoreSchema } from "./kidsartbench-schemas";

/** Schema for the analysis request input */
export const AnalysisInputSchema = z.object({
  artifactUrl: z.string().min(1, "Artifact URL is required"),
  artifactType: z.enum(["image", "audio"], {
    message: "Artifact type must be 'image' or 'audio'",
  }),
  /** Optional. Guest-supplied ISO date string for age-band gating. */
  guestDob: z.string().datetime().optional(),
  /** Optional. Child's narration about their artwork — enriches multimodal talent detection. */
  storyContext: z.string().max(500).optional(),
});

export type AnalysisInput = z.infer<typeof AnalysisInputSchema>;

/** Schema for a single detected talent */
export const TalentSchema = z.object({
  name: z.string().min(1),
  confidence: z.number().min(0).max(1),
  reasoning: z.string().min(1),
});

export type Talent = z.infer<typeof TalentSchema>;

/**
 * Schema for the full analysis response.
 *
 * `kidsArtBench` is the optional 9-dim rubric (structure / color / detail /
 * spatial / logic / composition / originality / narrative / technique) from
 * Katalis.docx §1.2. Marked optional so audio analysis and providers that
 * don't yet support it remain backward compatible.
 */
export const AnalysisOutputSchema = z.object({
  talents: z.array(TalentSchema).min(1, "At least one talent must be detected"),
  kidsArtBench: KidsArtBenchScoreSchema.optional(),
});

export type AnalysisOutput = z.infer<typeof AnalysisOutputSchema>;
