/**
 * Parent-child linking service.
 * Handles claiming children via access codes and querying parent-child relationships.
 */

import { db } from "@/lib/db";
import { accessCodes, parentChildren, children, discoveries, quests, squadMembers } from "@/lib/schema";
import { eq, and, desc } from "drizzle-orm";
import { getAgeGroup } from "@/lib/age";
import type { LinkedChild } from "./schemas";

/**
 * Claim a child by entering their access code.
 * Creates a ParentChild link if the code is valid and not already claimed by this user.
 */
export async function claimChild(
  userId: string,
  accessCode: string,
): Promise<{ success: boolean; childId?: string; error?: string }> {
  const code = await db.query.accessCodes.findFirst({
    where: eq(accessCodes.code, accessCode),
    with: { children: true },
  });

  if (!code) {
    return { success: false, error: "Invalid access code" };
  }

  if (!code.active) {
    return { success: false, error: "This access code has been deactivated" };
  }

  if (code.expiresAt && code.expiresAt < new Date()) {
    return { success: false, error: "This access code has expired" };
  }

  const child = code.children[0];
  if (!child) {
    return { success: false, error: "No child profile found for this code" };
  }

  const existing = await db.query.parentChildren.findFirst({
    where: and(eq(parentChildren.userId, userId), eq(parentChildren.childId, child.id)),
  });

  if (existing) {
    return { success: false, error: "You have already linked this child" };
  }

  await db.insert(parentChildren).values({ userId, childId: child.id });

  return { success: true, childId: child.id };
}

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
          accessCode: { columns: { code: true } },
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
      accessCode: child.accessCode?.code ?? undefined,
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
