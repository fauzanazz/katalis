/**
 * Badge definitions — code-first, version-controlled.
 *
 * Each badge has a slug matching an i18n key: badges.<slug>.name / badges.<slug>.description
 * Badge conditions are evaluated by the engine in engine.ts.
 */

import type { BadgeCategory, BadgeDefinition, BadgeTier } from "./schemas";

interface BadgeDef extends BadgeDefinition {
  /** i18n key for name: badges.<slug>.name */
  nameKey: string;
  /** i18n key for description: badges.<slug>.description */
  descriptionKey: string;
}

/** All badge definitions. Order determines display order. */
export const BADGE_DEFINITIONS: readonly BadgeDef[] = [
  {
    slug: "first_step",
    category: "progress",
    tier: "bronze",
    icon: "🎯",
    nameKey: "badges.first_step.name",
    descriptionKey: "badges.first_step.description",
  },
  {
    slug: "week_warrior",
    category: "progress",
    tier: "gold",
    icon: "🏆",
    nameKey: "badges.week_warrior.name",
    descriptionKey: "badges.week_warrior.description",
  },
  {
    slug: "reflector",
    category: "reflection",
    tier: "bronze",
    icon: "💭",
    nameKey: "badges.reflector.name",
    descriptionKey: "badges.reflector.description",
  },
  {
    slug: "deep_thinker",
    category: "reflection",
    tier: "silver",
    icon: "🧠",
    nameKey: "badges.deep_thinker.name",
    descriptionKey: "badges.deep_thinker.description",
  },
  {
    slug: "storyteller",
    category: "reflection",
    tier: "silver",
    icon: "🎙️",
    nameKey: "badges.storyteller.name",
    descriptionKey: "badges.storyteller.description",
  },
  {
    slug: "trailblazer",
    category: "mentorship",
    tier: "bronze",
    icon: "💬",
    nameKey: "badges.trailblazer.name",
    descriptionKey: "badges.trailblazer.description",
  },
  {
    slug: "creative_adapter",
    category: "creativity",
    tier: "silver",
    icon: "🔄",
    nameKey: "badges.creative_adapter.name",
    descriptionKey: "badges.creative_adapter.description",
  },
  {
    slug: "persistent_explorer",
    category: "creativity",
    tier: "gold",
    icon: "💪",
    nameKey: "badges.persistent_explorer.name",
    descriptionKey: "badges.persistent_explorer.description",
  },
] as const;

/** Lookup map by slug */
export const BADGE_BY_SLUG = new Map(
  BADGE_DEFINITIONS.map((b) => [b.slug, b]),
);

/** All slugs for quick iteration */
export const ALL_BADGE_SLUGS = BADGE_DEFINITIONS.map((b) => b.slug);

/** Get badge definition by slug */
export function getBadgeDef(slug: string): BadgeDef | undefined {
  return BADGE_BY_SLUG.get(slug);
}
