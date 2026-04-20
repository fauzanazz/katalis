/**
 * Parent report generator orchestrator.
 * Queries child data, calls AI, persists the report.
 */

import { prisma } from "@/lib/db";
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

  const child = await prisma.child.findUnique({
    where: { id: childId },
    include: {
      discoveries: {
        select: { detectedTalents: true },
        orderBy: { createdAt: "desc" },
        take: 3,
      },
      quests: {
        where: {
          status: { in: ["active", "completed"] },
          createdAt: { gte: periodStart },
        },
        include: {
          missions: { select: { status: true } },
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
      } catch {
        // skip
      }
    }
  }
  const uniqueTalents = [...new Set(talents)];

  const completedMissions = child.quests.reduce(
    (count, quest) => count + quest.missions.filter((m) => m.status === "completed").length,
    0,
  );

  const badgesEarned = await prisma.childBadge.findMany({
    where: {
      childId,
      createdAt: { gte: periodStart },
    },
    select: { badgeSlug: true },
  });

  const reflectionsCount = await prisma.reflectionEntry.count({
    where: {
      childId,
      createdAt: { gte: periodStart },
    },
  });

  const mentorInteractions = await prisma.mentorMessage.count({
    where: {
      session: { childId },
      createdAt: { gte: periodStart },
    },
  });

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

  const report = await prisma.parentReport.create({
    data: {
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
    },
  });

  return {
    id: report.id,
    childId: report.childId,
    type: report.type,
    period: JSON.parse(report.period),
    strengths: JSON.parse(report.strengths) as string[],
    growthAreas: JSON.parse(report.growthAreas) as string[],
    tips: JSON.parse(report.tips),
    summary: report.summary,
    badgeHighlights: JSON.parse(report.badgeHighlights) as string[],
    createdAt: report.createdAt.toISOString(),
  };
}

/**
 * Get existing reports for a child (visible to linked parent).
 */
export async function getReportsForChild(childId: string, parentId: string) {
  const reports = await prisma.parentReport.findMany({
    where: { childId, parentId },
    orderBy: { createdAt: "desc" },
  });

  return reports.map((r) => ({
    id: r.id,
    childId: r.childId,
    type: r.type,
    period: JSON.parse(r.period),
    strengths: JSON.parse(r.strengths) as string[],
    growthAreas: JSON.parse(r.growthAreas) as string[],
    tips: JSON.parse(r.tips),
    summary: r.summary,
    badgeHighlights: JSON.parse(r.badgeHighlights) as string[],
    createdAt: r.createdAt.toISOString(),
  }));
}

/**
 * Get a single report by ID (verifying parent ownership).
 */
export async function getReportById(reportId: string, parentId: string) {
  const report = await prisma.parentReport.findUnique({
    where: { id: reportId },
  });

  if (!report || report.parentId !== parentId) return null;

  return {
    id: report.id,
    childId: report.childId,
    type: report.type,
    period: JSON.parse(report.period),
    strengths: JSON.parse(report.strengths) as string[],
    growthAreas: JSON.parse(report.growthAreas) as string[],
    tips: JSON.parse(report.tips),
    summary: report.summary,
    badgeHighlights: JSON.parse(report.badgeHighlights) as string[],
    createdAt: report.createdAt.toISOString(),
  };
}
