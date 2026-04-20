import { NextResponse } from "next/server";
import { getChildSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { BADGE_DEFINITIONS } from "@/lib/badges";

/**
 * GET /api/badges
 *
 * Returns all badge definitions with the child's earned status.
 * Requires child authentication.
 */
export async function GET() {
  try {
    const session = await getChildSession();
    if (!session) {
      return NextResponse.json(
        { error: "unauthorized", message: "Authentication required" },
        { status: 401 },
      );
    }

    // Fetch earned badges for this child
    const earnedBadges = await prisma.childBadge.findMany({
      where: { childId: session.childId },
      select: {
        badgeSlug: true,
        createdAt: true,
        questId: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const earnedSlugSet = new Set(earnedBadges.map((b) => b.badgeSlug));
    const earnedBySlug = new Map(
      earnedBadges.map((b) => [
        b.badgeSlug,
        { earnedAt: b.createdAt.toISOString(), questId: b.questId },
      ]),
    );

    // Build response: all definitions with earned status
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

    return NextResponse.json({ badges });
  } catch (error) {
    console.error("Badges fetch error:", error);
    return NextResponse.json(
      { error: "server_error", message: "Failed to fetch badges" },
      { status: 500 },
    );
  }
}
