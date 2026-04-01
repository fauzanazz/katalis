/**
 * Zod schemas for Claude story analysis input and output validation.
 *
 * Input: { storyText: string, imageIds: string[], submissionType: "text" | "audio" }
 * Output: { talents: Array<{ name: string, confidence: number, reasoning: string }> }
 *
 * Reuses the same AnalysisOutput schema (Talent with name, confidence, reasoning)
 * to ensure consistent result display across artifact and story analysis paths.
 */

import { z } from "zod";
import { AnalysisOutputSchema, type AnalysisOutput } from "./schemas";

/** Minimum and maximum story text length */
export const STORY_MIN_LENGTH = 20;
export const STORY_MAX_LENGTH = 2000;

/** Schema for the story analysis request input */
export const StoryAnalysisInputSchema = z.object({
  storyText: z
    .string()
    .min(STORY_MIN_LENGTH, `Story must be at least ${STORY_MIN_LENGTH} characters`)
    .max(STORY_MAX_LENGTH, `Story must be at most ${STORY_MAX_LENGTH} characters`),
  imageIds: z
    .array(z.string())
    .min(1, "At least one image ID is required")
    .max(5, "At most 5 image IDs allowed"),
  submissionType: z.enum(["text", "audio"], {
    message: "Submission type must be 'text' or 'audio'",
  }),
});

export type StoryAnalysisInput = z.infer<typeof StoryAnalysisInputSchema>;

/** Output schema is same as AnalysisOutput for consistent results display */
export { AnalysisOutputSchema as StoryAnalysisOutputSchema };
export type { AnalysisOutput as StoryAnalysisOutput };
