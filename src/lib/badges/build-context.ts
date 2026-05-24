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

import { db } from "@/lib/db";
import {
  quests,
  reflectionEntries,
  mentorSessions,
  adjustmentEvents,
  childBadges,
} from "@/lib/schema";
import { eq, and, count, inArray } from "drizzle-orm";
import type { BadgeContext } from "./schemas";

interface BuildContextOptions {
  childId: string;
  questId?: string;
}

export async function buildBadgeContext({
  childId,
  questId,
}: BuildContextOptions): Promise<BadgeContext> {
  const childQuests = await db.query.quests.findMany({
    where: eq(quests.childId, childId),
    columns: { id: true },
    with: {
      missions: { columns: { status: true } },
    },
  });

  let completedMissionCount = 0;
  let totalMissionCount = 0;
  let questMissionTotal = 0;
  let questMissionCompleted = 0;

  for (const quest of childQuests) {
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

  if (!questId) {
    questMissionTotal = totalMissionCount;
    questMissionCompleted = completedMissionCount;
  }

  const [reflectionCountRow] = await db
    .select({ count: count() })
    .from(reflectionEntries)
    .where(eq(reflectionEntries.childId, childId));
  const reflectionCount = reflectionCountRow.count;

  let questReflectionCount = 0;
  if (questId) {
    const [questReflRow] = await db
      .select({ count: count() })
      .from(reflectionEntries)
      .where(
        and(
          eq(reflectionEntries.childId, childId),
          eq(reflectionEntries.questId, questId),
        ),
      );
    questReflectionCount = questReflRow.count;
  } else {
    questReflectionCount = reflectionCount;
  }

  const [voiceReflRow] = await db
    .select({ count: count() })
    .from(reflectionEntries)
    .where(
      and(
        eq(reflectionEntries.childId, childId),
        eq(reflectionEntries.type, "voice"),
      ),
    );
  const voiceReflectionCount = voiceReflRow.count;

  const [mentorRow] = await db
    .select({ count: count() })
    .from(mentorSessions)
    .where(eq(mentorSessions.childId, childId));
  const mentorSessionCount = mentorRow.count;

  // Count adjustment events via sessions belonging to this child
  const childSessionIds = (
    await db.query.mentorSessions.findMany({
      where: eq(mentorSessions.childId, childId),
      columns: { id: true },
    })
  ).map((s) => s.id);

  let adjustmentCount = 0;
  if (childSessionIds.length > 0) {
    const [adjRow] = await db
      .select({ count: count() })
      .from(adjustmentEvents)
      .where(inArray(adjustmentEvents.sessionId, childSessionIds));
    adjustmentCount = adjRow.count;
  }

  const earnedBadges = await db.query.childBadges.findMany({
    where: eq(childBadges.childId, childId),
    columns: { badgeSlug: true },
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
