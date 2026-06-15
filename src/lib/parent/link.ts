/**
 * Parent-child linking service.
 * Queries parent-child relationships and per-child stats. Children are created
 * under a parent (create-child / migrate-guest); there is no claim-by-code flow.
 */

import { db } from "@/lib/db";
import { parentChildren, quests } from "@/lib/schema";
import { eq, and, desc } from "drizzle-orm";
import { getAgeGroup } from "@/lib/age";
import type { LinkedChild } from "./schemas";

/**
 * Get all children linked to a parent user, with basic stats.
 */
export async function getParentChildren(userId: string): Promise<LinkedChild[]> {
  const links = await db.query.parentChildren.findMany({
    where: eq(parentChildren.userId, userId),
    with: {
      child: {
        with: {
          discoveries: { columns: { detectedTalents: true } },
          quests: {
            columns: { id: true, dream: true, status: true },
            orderBy: desc(quests.createdAt),
          },
          squadMemberships: { columns: { id: true } },
        },
      },
    },
    orderBy: desc(parentChildren.claimedAt),
  });

  return links.map((link) => {
    const child = link.child;

    const latestDiscovery = child.discoveries[child.discoveries.length - 1];
    let latestTalents: string[] = [];
    if (latestDiscovery?.detectedTalents) {
      try {
        const parsed = JSON.parse(latestDiscovery.detectedTalents) as Array<{ name: string }>;
        latestTalents = parsed.map((t) => t.name);
      } catch {
        latestTalents = [];
      }
    }

    const dob = child.dateOfBirth ?? null;
    return {
      id: child.id,
      name: child.name ?? undefined,
      locale: child.locale,
      claimedAt: link.claimedAt.toISOString(),
      dateOfBirth: dob ? dob.toISOString() : null,
      ageGroup: getAgeGroup(dob).band,
      latestTalents,
      questCount: child.quests.length,
      quests: child.quests,
    };
  });
}

/**
 * Verify that a user is linked to a specific child.
 */
export async function verifyParentChildLink(
  userId: string,
  childId: string,
): Promise<boolean> {
  const link = await db.query.parentChildren.findFirst({
    where: and(eq(parentChildren.userId, userId), eq(parentChildren.childId, childId)),
  });
  return link != null;
}
