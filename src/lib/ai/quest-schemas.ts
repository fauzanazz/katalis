/**
 * Zod schemas for Claude quest generation input and output validation.
 *
 * Input: { dream: string, localContext: string, talents: Array<{ name, confidence, reasoning }> }
 * Output: { missions: Array<{ day, title, description, instructions, materials, tips }> }
 *
 * Claude generates a personalized 7-day mission plan based on the child's
 * detected talents, their dream, and local context (environment/resources).
 */

import { z } from "zod";

/** Minimum and maximum lengths for dream and local context inputs */
export const DREAM_MIN_LENGTH = 10;
export const DREAM_MAX_LENGTH = 500;
export const CONTEXT_MIN_LENGTH = 10;
export const CONTEXT_MAX_LENGTH = 500;

/** Schema for a talent summary (passed from discovery results) */
export const TalentSummarySchema = z.object({
  name: z.string().min(1),
  confidence: z.number().min(0).max(1),
  reasoning: z.string().min(1),
});

export type TalentSummary = z.infer<typeof TalentSummarySchema>;

/** Schema for the quest generation request input */
export const QuestGenerationInputSchema = z.object({
  dream: z
    .string()
    .min(DREAM_MIN_LENGTH, `Dream must be at least ${DREAM_MIN_LENGTH} characters`)
    .max(DREAM_MAX_LENGTH, `Dream must be at most ${DREAM_MAX_LENGTH} characters`),
  localContext: z
    .string()
    .min(CONTEXT_MIN_LENGTH, `Local context must be at least ${CONTEXT_MIN_LENGTH} characters`)
    .max(CONTEXT_MAX_LENGTH, `Local context must be at most ${CONTEXT_MAX_LENGTH} characters`),
  talents: z
    .array(TalentSummarySchema)
    .optional(),
  discoveryId: z.string().optional(),
});

export type QuestGenerationInput = z.infer<typeof QuestGenerationInputSchema>;

/** Schema for a single mission within the 7-day plan */
export const MissionSchema = z.object({
  day: z.number().int().min(1).max(7),
  title: z.string().min(1),
  description: z.string().min(1),
  instructions: z.array(z.string().min(1)).min(1),
  materials: z.array(z.string().min(1)),
  tips: z.array(z.string().min(1)),
});

export type Mission = z.infer<typeof MissionSchema>;

/** Schema for the full quest generation response (7 missions) */
export const QuestGenerationOutputSchema = z.object({
  missions: z
    .array(MissionSchema)
    .length(7, "Quest must contain exactly 7 daily missions"),
});

export type QuestGenerationOutput = z.infer<typeof QuestGenerationOutputSchema>;
