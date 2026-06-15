import { createServerFn } from "@tanstack/react-start";
import { eq, desc } from "drizzle-orm";
import { getChildSession } from "@/lib/auth-start";
import { db } from "@/lib/db";
import { childBadges } from "@/lib/schema";
import { BADGE_DEFINITIONS } from "@/lib/badges";
import { ok, err, type Result } from "@/lib/server/result";

type Badge = {
  slug: string;
  category: string;
  tier: string;
  icon: string;
  earned: boolean;
  earnedAt: string | null;
  questId: string | null;
};

export const getBadgesFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<Result<{ badges: Badge[] }>> => {
    try {
      const session = await getChildSession();
      if (!session) {
        return err("unauthorized", "Authentication required");
      }

      const earnedBadges = await db.query.childBadges.findMany({
        where: eq(childBadges.childId, session.childId),
        columns: {
          badgeSlug: true,
          createdAt: true,
          questId: true,
        },
        orderBy: desc(childBadges.createdAt),
      });

      const earnedSlugSet = new Set(earnedBadges.map((b) => b.badgeSlug));
      const earnedBySlug = new Map(
        earnedBadges.map((b) => [
          b.badgeSlug,
          { earnedAt: b.createdAt.toISOString(), questId: b.questId },
        ]),
      );

      const badges = BADGE_DEFINITIONS.map((def) => {
        const earned = earnedBySlug.get(def.slug);
        return {
          slug: def.slug,
          category: def.category,
          tier: def.tier,
          icon: def.icon,
          earned: earnedSlugSet.has(def.slug),
          earnedAt: earned?.earnedAt ?? null,
          questId: earned?.questId ?? null,
        };
      });

      return ok({ badges });
    } catch (error) {
      console.error("Badges fetch error:", error);
      return err("server_error", "Failed to fetch badges");
    }
  },
);
