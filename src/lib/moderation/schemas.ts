/**
 * Zod schemas for content moderation input/output validation.
 */

import { z } from "zod";

/** Content types that can be moderated */
export const ContentTypeSchema = z.enum(["text", "image", "audio"]);
export type ContentType = z.infer<typeof ContentTypeSchema>;

/** Source types where content originates */
export const SourceTypeSchema = z.enum(["discovery", "quest", "gallery", "flag"]);
export type SourceType = z.infer<typeof SourceTypeSchema>;

/** Moderation statuses */
export const ModerationStatusSchema = z.enum([
  "pending",
  "approved",
  "blocked",
  "flagged",
  "redirected",
]);
export type ModerationStatus = z.infer<typeof ModerationStatusSchema>;

/** Harmful content categories */
export const HarmCategorySchema = z.enum([
  "violence",
  "self_harm",
  "sexual",
  "hate",
  "harassment",
  "spam",
  "other",
]);
export type HarmCategory = z.infer<typeof HarmCategorySchema>;

/** Severity levels */
export const SeveritySchema = z.enum(["low", "medium", "high", "critical"]);
export type Severity = z.infer<typeof SeveritySchema>;

/** Input for moderating content */
export const ModerationInputSchema = z.object({
  content: z.string().min(1, "Content is required"),
  contentType: ContentTypeSchema,
  sourceType: SourceTypeSchema,
  sourceId: z.string().optional(),
  childId: z.string().optional(),
});

export type ModerationInput = z.infer<typeof ModerationInputSchema>;

/** Result of a single moderation check */
export const ModerationResultSchema = z.object({
  allowed: z.boolean(),
  status: ModerationStatusSchema,
  category: HarmCategorySchema.optional(),
  severity: SeveritySchema.optional(),
  confidence: z.number().min(0).max(1).optional(),
  reasoning: z.string().optional(),
  redirectMessage: z.string().optional(),
});

export type ModerationResult = z.infer<typeof ModerationResultSchema>;

/** Image moderation input (URL-based) */
export const ImageModerationInputSchema = z.object({
  imageUrl: z.string().min(1, "Image URL is required"),
  sourceType: SourceTypeSchema,
  sourceId: z.string().optional(),
  childId: z.string().optional(),
});

export type ImageModerationInput = z.infer<typeof ImageModerationInputSchema>;
