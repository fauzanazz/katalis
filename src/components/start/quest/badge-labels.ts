import { m } from "@/paraglide/messages";

/**
 * Paraglide compiles messages to statically-named functions and has NO runtime
 * key lookup, so the next-intl dynamic access `t(`${badge.slug}.name`)` cannot
 * be ported verbatim. This static slug→message map replaces it. Keyed by the
 * badge slugs defined in `@/lib/badges` definitions; falls back to the raw slug
 * (name) / empty string (description) for unknown slugs.
 */
const BADGE_LABELS: Record<string, { name: () => string; description: () => string }> = {
  first_step: { name: m.badges_first_step_name, description: m.badges_first_step_description },
  week_warrior: { name: m.badges_week_warrior_name, description: m.badges_week_warrior_description },
  reflector: { name: m.badges_reflector_name, description: m.badges_reflector_description },
  deep_thinker: { name: m.badges_deep_thinker_name, description: m.badges_deep_thinker_description },
  storyteller: { name: m.badges_storyteller_name, description: m.badges_storyteller_description },
  trailblazer: { name: m.badges_trailblazer_name, description: m.badges_trailblazer_description },
  creative_adapter: { name: m.badges_creative_adapter_name, description: m.badges_creative_adapter_description },
  persistent_explorer: { name: m.badges_persistent_explorer_name, description: m.badges_persistent_explorer_description },
};

export function badgeName(slug: string): string {
  return BADGE_LABELS[slug]?.name() ?? slug;
}

export function badgeDescription(slug: string): string {
  return BADGE_LABELS[slug]?.description() ?? "";
}
