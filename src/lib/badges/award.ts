/**
 * Award badges to a child — creates ChildBadge records in the database.
 *
 * Called after evaluateBadges() returns new badge slugs.
 * Returns EarnedBadge[] for inclusion in API responses.
 */

import { prisma } from "@/lib/db";
import { getBadgeDef } from "./definitions";
import type { BadgeTrigger, EarnedBadge } from "./schemas";

interface AwardBadgesOptions {
  childId: string;
  newlyEarnedSlugs: string[];
  trigger: BadgeTrigger;
  questId?: string;
}

export async function awardBadges({
  childId,
  newlyEarnedSlugs,
  trigger,
  questId,
}: AwardBadgesOptions): Promise<EarnedBadge[]> {
  if (newlyEarnedSlugs.length === 0) return [];

  const results: EarnedBadge[] = [];

  for (const slug of newlyEarnedSlugs) {
    const def = getBadgeDef(slug);
    if (!def) continue;

    await prisma.childBadge.create({
      data: {
        childId,
        badgeSlug: slug,
        questId: questId ?? null,
        trigger,
        metadata: JSON.stringify({ trigger }),
      },
    });

    results.push({
      slug,
      category: def.category,
      tier: def.tier,
      icon: def.icon,
      earnedAt: new Date().toISOString(),
      questId: questId ?? null,
      isNew: true,
    });
  }

  return results;
}
