"use client";

import { useTranslations } from "next-intl";
import { useState, useEffect, useCallback } from "react";
import { Lock, Award } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { BadgeCategory } from "@/lib/badges";

interface BadgeData {
  slug: string;
  category: BadgeCategory;
  tier: string;
  icon: string;
  earned: boolean;
  earnedAt: string | null;
  questId: string | null;
}

const CATEGORY_FILTERS: Array<{ value: BadgeCategory | "all"; labelKey: string }> = [
  { value: "all", labelKey: "categoryAll" },
  { value: "progress", labelKey: "categoryProgress" },
  { value: "creativity", labelKey: "categoryCreativity" },
  { value: "reflection", labelKey: "categoryReflection" },
  { value: "mentorship", labelKey: "categoryMentorship" },
];

const TIER_COLORS: Record<string, string> = {
  bronze: "border-amber-300 bg-amber-50",
  silver: "border-gray-300 bg-gray-50",
  gold: "border-yellow-400 bg-yellow-50",
};

export function BadgeGrid() {
  const t = useTranslations("badges");
  const [badges, setBadges] = useState<BadgeData[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<BadgeCategory | "all">("all");

  const fetchBadges = useCallback(async () => {
    try {
      const res = await fetch("/api/badges");
      if (!res.ok) return;
      const data = await res.json();
      setBadges(data.badges ?? []);
    } catch {
      // Silently fail — badges are non-critical
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBadges();
  }, [fetchBadges]);

  const filtered =
    activeCategory === "all"
      ? badges
      : badges.filter((b) => b.category === activeCategory);

  const earnedCount = badges.filter((b) => b.earned).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Award className="size-6 animate-pulse text-muted-foreground" aria-hidden="true" />
      </div>
    );
  }

  return (
    <section aria-labelledby="badges-title">
      <div className="mb-4">
        <h2
          id="badges-title"
          className="flex items-center gap-2 text-lg font-bold text-foreground"
        >
          <Award className="size-5" aria-hidden="true" />
          {t("title")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("subtitle")} ({earnedCount}/{badges.length})
        </p>
      </div>

      {/* Category filters */}
      <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="Badge categories">
        {CATEGORY_FILTERS.map((filter) => (
          <Button
            key={filter.value}
            variant={activeCategory === filter.value ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveCategory(filter.value)}
            role="tab"
            aria-selected={activeCategory === filter.value}
          >
            {t(filter.labelKey)}
          </Button>
        ))}
      </div>

      {/* Badge grid */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-4 gap-3 sm:grid-cols-4 md:grid-cols-8">
          {filtered.map((badge) => (
            <BadgeCard key={badge.slug} badge={badge} />
          ))}
        </div>
      ) : (
        <p className="py-4 text-center text-sm italic text-muted-foreground">
          {t("empty")}
        </p>
      )}
    </section>
  );
}

function BadgeCard({ badge }: { badge: BadgeData }) {
  const t = useTranslations("badges");
  const tierColor = TIER_COLORS[badge.tier] ?? TIER_COLORS.bronze;

  return (
    <div
      className={`flex flex-col items-center gap-1 rounded-xl border p-3 text-center transition-opacity ${
        badge.earned ? tierColor : "border-border/40 bg-muted/30 opacity-50"
      }`}
      title={
        badge.earned
          ? `${t(`${badge.slug}.name`)} — ${t(`${badge.slug}.description`)}`
          : `${t("locked")}: ${t(`${badge.slug}.name`)}`
      }
    >
      <span className="text-2xl" aria-hidden="true">
        {badge.earned ? badge.icon : <Lock className="size-6 text-muted-foreground" />}
      </span>
      <span className="text-[10px] font-medium leading-tight text-foreground">
        {t(`${badge.slug}.name`)}
      </span>
    </div>
  );
}
