import { z } from "zod";

/** Badge category — groups badges thematically */
export const BadgeCategorySchema = z.enum([
  "progress",
  "creativity",
  "reflection",
  "mentorship",
]);

/** Badge tier — rarity level */
export const BadgeTierSchema = z.enum(["bronze", "silver", "gold"]);

/** Badge trigger — what action earned this badge */
export const BadgeTriggerSchema = z.enum([
  "mission_complete",
  "reflection",
  "mentor_message",
  "adjustment",
]);

/** A badge definition — lives in code, not the database */
export const BadgeDefinitionSchema = z.object({
  slug: z.string(),
  category: BadgeCategorySchema,
  tier: BadgeTierSchema,
  icon: z.string(),
});

/** Context passed to the badge evaluation engine */
export const BadgeContextSchema = z.object({
  childId: z.string().cuid(),
  questId: z.string().cuid().optional(),
  completedMissionCount: z.number().int().min(0),
  totalMissionCount: z.number().int().min(0),
  reflectionCount: z.number().int().min(0),
  questReflectionCount: z.number().int().min(0),
  hasUsedMentorChat: z.boolean(),
  adjustmentCount: z.number().int().min(0),
  hasVoiceReflection: z.boolean(),
  existingBadgeSlugs: z.array(z.string()),
});

/** A badge earned by a child — returned by the API */
export const EarnedBadgeSchema = z.object({
  slug: z.string(),
  category: BadgeCategorySchema,
  tier: BadgeTierSchema,
  icon: z.string(),
  earnedAt: z.string(), // ISO date
  questId: z.string().nullable(),
  isNew: z.boolean().default(false),
});

export type BadgeCategory = z.infer<typeof BadgeCategorySchema>;
export type BadgeTier = z.infer<typeof BadgeTierSchema>;
export type BadgeTrigger = z.infer<typeof BadgeTriggerSchema>;
export type BadgeDefinition = z.infer<typeof BadgeDefinitionSchema>;
export type BadgeContext = z.infer<typeof BadgeContextSchema>;
export type EarnedBadge = z.infer<typeof EarnedBadgeSchema>;
