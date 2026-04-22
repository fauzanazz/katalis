/**
 * Parent-child linking service.
 * Handles claiming children via access codes and querying parent-child relationships.
 */

import { prisma } from "@/lib/db";
import type { LinkedChild } from "./schemas";

/**
 * Claim a child by entering their access code.
 * Creates a ParentChild link if the code is valid and not already claimed by this user.
 */
export async function claimChild(
  userId: string,
  accessCode: string,
): Promise<{ success: boolean; childId?: string; error?: string }> {
  const code = await prisma.accessCode.findUnique({
    where: { code: accessCode },
    include: { children: true },
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

  const existing = await prisma.parentChild.findUnique({
    where: {
      userId_childId: { userId, childId: child.id },
    },
  });

  if (existing) {
    return { success: false, error: "You have already linked this child" };
  }

  await prisma.parentChild.create({
    data: { userId, childId: child.id },
  });

  return { success: true, childId: child.id };
}

/**
 * Get all children linked to a parent user, with basic stats.
 */
export async function getParentChildren(userId: string): Promise<LinkedChild[]> {
  const links = await prisma.parentChild.findMany({
    where: { userId },
    include: {
      child: {
        include: {
          discoveries: { select: { detectedTalents: true } },
          quests: { select: { id: true, status: true } },
          squadMemberships: { select: { id: true } },
        },
      },
    },
    orderBy: { claimedAt: "desc" },
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

    return {
      id: child.id,
      name: child.name ?? undefined,
      locale: child.locale,
      claimedAt: link.claimedAt.toISOString(),
      latestTalents,
      questCount: child.quests.length,
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
  const link = await prisma.parentChild.findUnique({
    where: {
      userId_childId: { userId, childId },
    },
  });
  return link !== null;
}
