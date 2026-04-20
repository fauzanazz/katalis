/**
 * Zod schemas for the Quest Buddy mentor system.
 *
 * Covers session creation, message exchange, frustration detection,
 * mission adjustment, and daily reflection.
 */
import { z } from "zod";

/** Frustration levels used in mentor context */
export const FrustrationLevelSchema = z.enum(["none", "low", "medium", "high"]);
export type FrustrationLevel = z.infer<typeof FrustrationLevelSchema>;

/** Mentor session status */
export const SessionStatusSchema = z.enum(["active", "completed"]);
export type SessionStatus = z.infer<typeof SessionStatusSchema>;

/** Creating a mentor session (auto on mission start) */
export const CreateSessionInputSchema = z.object({
  questId: z.string().cuid(),
  missionId: z.string().cuid(),
});
export type CreateSessionInput = z.infer<typeof CreateSessionInputSchema>;

/** Sending a message to the mentor */
export const SendMessageInputSchema = z.object({
  sessionId: z.string().cuid(),
  content: z
    .string()
    .min(1, "Message cannot be empty")
    .max(1000, "Message is too long"),
});
export type SendMessageInput = z.infer<typeof SendMessageInputSchema>;

/** Mentor AI response */
export const MentorResponseSchema = z.object({
  message: z.string(),
  suggestions: z.array(z.string()).max(3).optional(),
  frustrationLevel: FrustrationLevelSchema.optional(),
  offerAdjustment: z.boolean().optional(),
});
export type MentorResponse = z.infer<typeof MentorResponseSchema>;

/** Mission adjustment request */
export const AdjustmentInputSchema = z.object({
  sessionId: z.string().cuid(),
  reason: z.enum(["frustration_detected", "child_requested", "time_based"]),
});
export type AdjustmentInput = z.infer<typeof AdjustmentInputSchema>;

/** Simplified mission output from AI */
export const SimplifiedMissionSchema = z.object({
  simplifiedInstructions: z.array(z.string()).min(1).max(6),
  encouragementMessage: z.string(),
});
export type SimplifiedMission = z.infer<typeof SimplifiedMissionSchema>;

/** Daily reflection input */
export const ReflectionInputSchema = z.object({
  questId: z.string().cuid(),
  missionDay: z.number().int().min(1).max(7),
  type: z.enum(["text", "voice"]),
  content: z
    .string()
    .min(5, "Reflection is too short")
    .max(2000, "Reflection is too long"),
  fileUrl: z.string().url().optional(),
});
export type ReflectionInput = z.infer<typeof ReflectionInputSchema>;

/** AI reflection summary */
export const ReflectionSummarySchema = z.object({
  summary: z.string(),
  strengths: z.array(z.string()).max(3),
  encouragement: z.string(),
});
export type ReflectionSummary = z.infer<typeof ReflectionSummarySchema>;
