/**
 * Badge system — barrel export.
 *
 * Usage:
 *   import { evaluateBadges, getBadgeDef, BADGE_DEFINITIONS } from "@/lib/badges";
 */

export { evaluateBadges } from "./engine";
export {
  BADGE_DEFINITIONS,
  BADGE_BY_SLUG,
  ALL_BADGE_SLUGS,
  getBadgeDef,
} from "./definitions";
export type {
  BadgeCategory,
  BadgeTier,
  BadgeTrigger,
  BadgeDefinition,
  BadgeContext,
  EarnedBadge,
} from "./schemas";
