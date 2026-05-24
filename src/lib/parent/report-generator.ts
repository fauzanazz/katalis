/**
 * Parent report generator orchestrator.
 * Queries child data, calls AI, persists the report.
 */

import { db } from "@/lib/db";
import {
  children,
  childBadges,
  reflectionEntries,
  mentorMessages,
  mentorSessions,
  adjustmentEvents,
  parentReports,
  missions,
  quests,
} from "@/lib/schema";
import { eq, and, gte, inArray, count, desc } from "drizzle-orm";
import { generateAIReport } from "@/lib/ai/parent-report";

interface GenerateReportOptions {
  parentId: string;
  childId: string;
  type: "weekly" | "biweekly";
}

export async function generateParentReport(options: GenerateReportOptions) {
  const { parentId, childId, type } = options;

  const periodEnd = new Date();
  const periodDays = type === "weekly" ? 7 : 14;
  const periodStart = new Date(periodEnd.getTime() - periodDays * 24 * 60 * 60 * 1000);

  const child = await db.query.children.findFirst({
    where: eq(children.id, childId),
    with: {
      discoveries: {
        columns: { detectedTalents: true },
        orderBy: (d, { desc }) => desc(d.createdAt),
        limit: 3,
      },
      quests: {
        where: and(
          inArray(quests.status, ["active", "completed"]),
          gte(quests.createdAt, periodStart),
        ),
        with: {
          missions: { columns: { status: true } },
        },
      },
    },
  });

  if (!child) {
    throw new Error("Child not found");
  }

  const talents: string[] = [];
  for (const disc of child.discoveries) {
    if (disc.detectedTalents) {
      try {
        const parsed = JSON.parse(disc.detectedTalents) as Array<{ name: string }>;
        talents.push(...parsed.map((t) => t.name));
      } catch (parseError) {
        console.warn("Failed to parse talent data for child:", childId, parseError);
      }
    }
  }
  const uniqueTalents = [...new Set(talents)];

  const completedMissions = child.quests.reduce(
    (cnt, quest) => cnt + quest.missions.filter((m) => m.status === "completed").length,
    0,
  );

  const badgesEarned = await db
    .select({ badgeSlug: childBadges.badgeSlug })
    .from(childBadges)
    .where(and(eq(childBadges.childId, childId), gte(childBadges.createdAt, periodStart)));

  const [reflectionsRow] = await db
    .select({ value: count() })
    .from(reflectionEntries)
    .where(and(eq(reflectionEntries.childId, childId), gte(reflectionEntries.createdAt, periodStart)));
  const reflectionsCount = reflectionsRow?.value ?? 0;

  const [mentorInteractionsRow] = await db
    .select({ value: count() })
    .from(mentorMessages)
    .innerJoin(mentorSessions, eq(mentorMessages.sessionId, mentorSessions.id))
    .where(and(eq(mentorSessions.childId, childId), gte(mentorMessages.createdAt, periodStart)));
  const mentorInteractions = mentorInteractionsRow?.value ?? 0;

  // Mission engagement detail for §7.1c: frustration events + adjustments.
  // We classify a mentor message as a "frustration event" when its meta JSON
  // carries frustrationLevel ∈ {medium, high} — soft check-in triggers.
  const recentMentorMessages = await db
    .select({ meta: mentorMessages.meta })
    .from(mentorMessages)
    .innerJoin(mentorSessions, eq(mentorMessages.sessionId, mentorSessions.id))
    .where(
      and(
        eq(mentorSessions.childId, childId),
        eq(mentorMessages.role, "mentor"),
        gte(mentorMessages.createdAt, periodStart),
      ),
    );
  let frustrationEvents = 0;
  for (const m of recentMentorMessages) {
    if (!m.meta) continue;
    try {
      const parsed = JSON.parse(m.meta) as { frustrationLevel?: string };
      if (parsed.frustrationLevel === "medium" || parsed.frustrationLevel === "high") {
        frustrationEvents += 1;
      }
    } catch {
      // Ignore malformed meta.
    }
  }

  const [adjustmentEventsRow] = await db
    .select({ value: count() })
    .from(adjustmentEvents)
    .innerJoin(mentorSessions, eq(adjustmentEvents.sessionId, mentorSessions.id))
    .where(and(eq(mentorSessions.childId, childId), gte(adjustmentEvents.createdAt, periodStart)));
  const adjustmentEventsCount = adjustmentEventsRow?.value ?? 0;

  const engagementMetadata = {
    completedMissions,
    completedQuests: child.quests.length,
    frustrationEvents,
    adjustmentEvents: adjustmentEventsCount,
    reflectionsCount,
    mentorInteractions,
  };

  const aiReport = await generateAIReport({
    childTalents: uniqueTalents,
    completedQuests: child.quests.length,
    completedMissions,
    badgesEarned: badgesEarned.map((b) => b.badgeSlug),
    reflectionsCount,
    mentorInteractions,
    periodStart: periodStart.toISOString(),
    periodEnd: periodEnd.toISOString(),
  });

  const report = (
    await db
      .insert(parentReports)
      .values({
        parentId,
        childId,
        type,
        period: JSON.stringify({
          start: periodStart.toISOString(),
          end: periodEnd.toISOString(),
        }),
        strengths: JSON.stringify(aiReport.strengths),
        growthAreas: JSON.stringify(aiReport.growthAreas),
        tips: JSON.stringify(aiReport.tips),
        summary: aiReport.summary,
        badgeHighlights: JSON.stringify(aiReport.badgeHighlights),
        metadata: JSON.stringify({ engagement: engagementMetadata }),
      })
      .returning()
  )[0];

  return toReportResponse(report);
}

/**
 * Get existing reports for a child (visible to linked parent).
 */
export async function getReportsForChild(childId: string, parentId: string) {
  const reports = await db.query.parentReports.findMany({
    where: and(eq(parentReports.childId, childId), eq(parentReports.parentId, parentId)),
    orderBy: desc(parentReports.createdAt),
  });

  return reports.map(toReportResponse);
}

/**
 * Get a single report by ID (verifying parent ownership).
 */
export async function getReportById(reportId: string, parentId: string) {
  const report = await db.query.parentReports.findFirst({
    where: eq(parentReports.id, reportId),
  });

  if (!report || report.parentId !== parentId) return null;

  return toReportResponse(report);
}

interface EngagementMetadata {
  completedMissions: number;
  completedQuests: number;
  frustrationEvents: number;
  adjustmentEvents: number;
  reflectionsCount: number;
  mentorInteractions: number;
}

function parseEngagement(metadata: string | null | undefined): EngagementMetadata | null {
  if (!metadata) return null;
  try {
    const parsed = JSON.parse(metadata) as { engagement?: EngagementMetadata };
    return parsed.engagement ?? null;
  } catch {
    return null;
  }
}

function toReportResponse(r: {
  id: string;
  childId: string;
  type: string;
  period: string;
  strengths: string;
  growthAreas: string;
  tips: string;
  summary: string;
  badgeHighlights: string;
  metadata?: string | null;
  createdAt: Date;
}) {
  return {
    id: r.id,
    childId: r.childId,
    type: r.type,
    period: JSON.parse(r.period),
    strengths: JSON.parse(r.strengths) as string[],
    growthAreas: JSON.parse(r.growthAreas) as string[],
    tips: JSON.parse(r.tips),
    summary: r.summary,
    badgeHighlights: JSON.parse(r.badgeHighlights) as string[],
    engagement: parseEngagement(r.metadata),
    createdAt: r.createdAt.toISOString(),
  };
}
