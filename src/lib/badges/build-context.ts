/**
 * Build a BadgeContext from the database for a given child.
 *
 * Gathers all the signals the badge engine needs:
 * - Completed mission count (lifetime + quest-scoped)
 * - Reflection count (lifetime + quest-scoped)
 * - Mentor chat usage
 * - Adjustment count
 * - Voice reflection usage
 * - Already-earned badge slugs
 */

import { prisma } from "@/lib/db";
import type { BadgeContext } from "./schemas";

interface BuildContextOptions {
  childId: string;
  questId?: string;
}

export async function buildBadgeContext({
  childId,
  questId,
}: BuildContextOptions): Promise<BadgeContext> {
  // Fetch all quests for this child to count completed missions
  const quests = await prisma.quest.findMany({
    where: { childId },
    select: {
      id: true,
      missions: {
        select: { status: true },
      },
    },
  });

  let completedMissionCount = 0;
  let totalMissionCount = 0;
  let questMissionTotal = 0;
  let questMissionCompleted = 0;

  for (const quest of quests) {
    const completed = quest.missions.filter(
      (m) => m.status === "completed",
    ).length;
    completedMissionCount += completed;
    totalMissionCount += quest.missions.length;

    if (questId && quest.id === questId) {
      questMissionTotal = quest.missions.length;
      questMissionCompleted = completed;
    }
  }

  // If no specific questId, use totals
  if (!questId) {
    questMissionTotal = totalMissionCount;
    questMissionCompleted = completedMissionCount;
  }

  // Reflection counts
  const reflectionCount = await prisma.reflectionEntry.count({
    where: { childId },
  });

  let questReflectionCount = 0;
  if (questId) {
    questReflectionCount = await prisma.reflectionEntry.count({
      where: { childId, questId },
    });
  } else {
    questReflectionCount = reflectionCount;
  }

  // Voice reflection check
  const voiceReflectionCount = await prisma.reflectionEntry.count({
    where: { childId, type: "voice" },
  });

  // Mentor chat usage
  const mentorSessionCount = await prisma.mentorSession.count({
    where: { childId },
  });

  // Adjustment count (lifetime)
  const adjustmentCount = await prisma.adjustmentEvent.count({
    where: { session: { childId } },
  });

  // Already-earned badges
  const earnedBadges = await prisma.childBadge.findMany({
    where: { childId },
    select: { badgeSlug: true },
  });
  const existingBadgeSlugs = earnedBadges.map((b) => b.badgeSlug);

  return {
    childId,
    questId,
    completedMissionCount: questMissionCompleted,
    totalMissionCount: questMissionTotal,
    reflectionCount,
    questReflectionCount,
    hasUsedMentorChat: mentorSessionCount > 0,
    adjustmentCount,
    hasVoiceReflection: voiceReflectionCount > 0,
    existingBadgeSlugs,
  };
}
