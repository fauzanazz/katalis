/**
 * Badge evaluation engine — pure function, rule-based v1.
 *
 * Takes a BadgeContext snapshot and returns slugs of newly earned badges.
 * Follows the same pattern as src/lib/ai/mentor/frustration.ts:
 *   - Pure function with typed context input
 *   - Each badge has an independent condition
 *   - Returns only NEW badges (not already earned)
 */

import type { BadgeContext } from "./schemas";
import { ALL_BADGE_SLUGS } from "./definitions";

/**
 * A single badge rule: returns true if the child has earned this badge.
 *
 * Each rule is independent — the engine evaluates all rules and filters
 * out already-earned badges.
 */
type BadgeRule = (ctx: BadgeContext) => boolean;

/** Badge evaluation rules, keyed by slug. */
const RULES: Record<string, BadgeRule> = {
  /** Complete your first mission */
  first_step: (ctx) => ctx.completedMissionCount >= 1,

  /** Complete all 7 days of a quest */
  week_warrior: (ctx) =>
    ctx.totalMissionCount > 0 &&
    ctx.completedMissionCount >= ctx.totalMissionCount,

  /** Write your first daily reflection */
  reflector: (ctx) => ctx.reflectionCount >= 1,

  /** Reflect on 3+ days within a single quest */
  deep_thinker: (ctx) => ctx.questReflectionCount >= 3,

  /** Share a voice reflection */
  storyteller: (ctx) => ctx.hasVoiceReflection,

  /** Use the Quest Buddy mentor chat */
  trailblazer: (ctx) => ctx.hasUsedMentorChat,

  /** Accept a mission adjustment (constructive divergence) */
  creative_adapter: (ctx) => ctx.adjustmentCount >= 1,

  /** Persist through 2+ adjustments (grit and determination) */
  persistent_explorer: (ctx) => ctx.adjustmentCount >= 2,
};

/**
 * Evaluate which new badges a child has earned.
 *
 * @param context - Snapshot of the child's current state
 * @returns Array of badge slugs that are newly earned (not in existingBadgeSlugs)
 */
export function evaluateBadges(context: BadgeContext): string[] {
  const earned: string[] = [];

  for (const slug of ALL_BADGE_SLUGS) {
    // Skip already-earned badges
    if (context.existingBadgeSlugs.includes(slug)) continue;

    const rule = RULES[slug];
    if (rule && rule(context)) {
      earned.push(slug);
    }
  }

  return earned;
}
