import { useEffect, useState } from "react";
import { Lock } from "lucide-react";
import { m } from "@/paraglide/messages";
import { BADGE_DEFINITIONS } from "@/lib/badges/definitions";
import { useApp } from "../app/context";
import { listBadges } from "../data/store";
import { t } from "../data/types";
import type { LocalizedText } from "../data/types";

// Tier labels — local trilingual constants (tier keys not in confirmed m.* list)
const TIER_LABELS: Record<string, LocalizedText> = {
  bronze: { id: "Perunggu", en: "Bronze", zh: "铜牌" },
  silver: { id: "Perak", en: "Silver", zh: "银牌" },
  gold: { id: "Emas", en: "Gold", zh: "金牌" },
} satisfies Record<string, LocalizedText>;

// m.* cannot be indexed dynamically — resolve per-slug name via switch
function badgeName(slug: string): string {
  switch (slug) {
    case "first_step":          return m.badges_first_step_name();
    case "week_warrior":        return m.badges_week_warrior_name();
    case "reflector":           return m.badges_reflector_name();
    case "deep_thinker":        return m.badges_deep_thinker_name();
    case "storyteller":         return m.badges_storyteller_name();
    case "trailblazer":         return m.badges_trailblazer_name();
    case "creative_adapter":    return m.badges_creative_adapter_name();
    case "persistent_explorer": return m.badges_persistent_explorer_name();
    default:                    return slug;
  }
}

// m.* cannot be indexed dynamically — resolve per-slug description via switch
function badgeDescription(slug: string): string {
  switch (slug) {
    case "first_step":          return m.badges_first_step_description();
    case "week_warrior":        return m.badges_week_warrior_description();
    case "reflector":           return m.badges_reflector_description();
    case "deep_thinker":        return m.badges_deep_thinker_description();
    case "storyteller":         return m.badges_storyteller_description();
    case "trailblazer":         return m.badges_trailblazer_description();
    case "creative_adapter":    return m.badges_creative_adapter_description();
    case "persistent_explorer": return m.badges_persistent_explorer_description();
    default:                    return "";
  }
}

export function Badges() {
  const { profile, locale } = useApp();
  const [earned, setEarned] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!profile) return;
    let active = true;
    listBadges(profile.id).then((rows) => {
      if (!active) return;
      setEarned(new Set(rows.map((r) => r.slug)));
    });
    return () => {
      active = false;
    };
  }, [profile]);

  if (!profile) return null;

  const noneEarned = earned.size === 0;

  return (
    <div className="flex flex-col gap-5 p-5">
      <header className="pt-2">
        <h1 className="type-h2 text-ink">{m.badges_title()}</h1>
        <p className="text-muted-foreground">{m.badges_subtitle()}</p>
      </header>

      {noneEarned && (
        <p className="rounded-2xl bg-plain-surface p-4 text-center text-sm text-muted-foreground shadow-sm">
          {m.badges_empty()}
        </p>
      )}

      <ul className="grid grid-cols-2 gap-4">
        {BADGE_DEFINITIONS.map((badge) => {
          const isEarned = earned.has(badge.slug);
          return (
            <li
              key={badge.slug}
              className={[
                "flex flex-col items-center gap-2 rounded-2xl p-4 shadow-sm text-center",
                isEarned ? "bg-yellow-sun-light" : "bg-muted opacity-60",
              ].join(" ")}
            >
              {/* Icon */}
              <span className="text-4xl leading-none" aria-hidden>
                {badge.icon}
              </span>

              {/* Name */}
              <span className="text-sm font-bold leading-tight text-ink">
                {badgeName(badge.slug)}
              </span>

              {/* Description */}
              <span className="text-xs leading-snug text-muted-foreground">
                {badgeDescription(badge.slug)}
              </span>

              {/* Tier indicator */}
              <span className="mt-auto text-xs capitalize opacity-60">
                {t(TIER_LABELS[badge.tier] ?? TIER_LABELS.bronze, locale)}
              </span>

              {/* Earned / Locked label */}
              <span className="inline-flex items-center gap-1 rounded-full bg-white/30 px-2 py-0.5 text-xs font-medium text-ink">
                {isEarned ? (
                  m.badges_earned()
                ) : (
                  <>
                    <Lock className="size-3" aria-hidden />
                    {m.badges_locked()}
                  </>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
