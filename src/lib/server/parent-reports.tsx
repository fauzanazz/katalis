import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { eq, count, inArray } from "drizzle-orm";
import { renderToBuffer } from "@react-pdf/renderer";
import { db } from "@/lib/db";
import {
  users,
  parentReports,
  interestSignals,
  childInterestProfiles,
  missionInterestAssessments,
  reflectionEntries,
  galleryEntries,
  childBadges,
  parentQuestFollows,
  discoveryRatings,
  discoveries,
  quests,
  children,
} from "@/lib/schema";
import { getUserSession, isStepUpFresh } from "@/lib/auth-start";
import { verifyParentChildLink } from "@/lib/parent/link";
import {
  getReportsForChild,
  generateParentReport,
} from "@/lib/parent/report-generator";
import { GenerateReportSchema } from "@/lib/parent/schemas";
import { ParentReportPDF } from "@/lib/parent/pdf-template";
import { createInterestAuditEvent } from "@/lib/interests/repository";
import { hashPassword } from "@/lib/password";
import { ok, err, type Result } from "@/lib/server/result";

// ---------------------------------------------------------------------------
// Public interfaces
// ---------------------------------------------------------------------------

export interface ReportEngagement {
  completedMissions: number;
  completedQuests: number;
  frustrationEvents: number;
  adjustmentEvents: number;
  reflectionsCount: number;
  mentorInteractions: number;
}

export interface ReportPeriod {
  start: string;
  end: string;
}

export interface ReportTip {
  title: string;
  description: string;
  materials: string[];
  category: string;
}

export interface ReportData {
  id: string;
  childId: string;
  type: string;
  period: ReportPeriod;
  strengths: string[];
  growthAreas: string[];
  tips: ReportTip[];
  summary: string;
  badgeHighlights: string[];
  createdAt: string;
}

export interface DeletionCounts {
  interestSignals: number;
  interestProfiles: number;
  missionAssessments: number;
  reflections: number;
  galleryEntries: number;
  childBadges: number;
  parentQuestFollows: number;
  discoveryRatings: number;
  quests: number;
  discoveries: number;
}

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const ListReportsSchema = z.object({
  childId: z.string().min(1),
});

const GenerateSchema = GenerateReportSchema;

const DownloadPdfSchema = z.object({
  reportId: z.string().min(1),
});

const ChangePasswordSchema = z.object({
  newPassword: z.string().min(8).max(128),
});

const DeleteChildDataSchema = z.object({
  childId: z.string().min(1),
  reason: z.string().max(500).optional(),
});

// ---------------------------------------------------------------------------
// Server functions
// ---------------------------------------------------------------------------

export const listChildReportsFn = createServerFn({ method: "GET" })
  .validator((d: unknown) => ListReportsSchema.parse(d))
  .handler(async ({ data }): Promise<Result<{ reports: ReportData[] }>> => {
    const session = await getUserSession();
    if (!session) return err("unauthorized", "Authentication required");

    if (!(await isStepUpFresh())) return err("step_up_required", "Password re-authentication required");

    const linked = await verifyParentChildLink(session.userId, data.childId);
    if (!linked) return err("forbidden", "You are not linked to this child");

    const reports = await getReportsForChild(data.childId, session.userId);
    return ok({ reports: reports as ReportData[] });
  });

export const generateChildReportFn = createServerFn({ method: "POST" })
  .validator((d: unknown) => GenerateSchema.parse(d))
  .handler(async ({ data }): Promise<Result<{ report: ReportData }>> => {
    const session = await getUserSession();
    if (!session) return err("unauthorized", "Authentication required");

    if (!(await isStepUpFresh())) return err("step_up_required", "Password re-authentication required");

    const linked = await verifyParentChildLink(session.userId, data.childId);
    if (!linked) return err("forbidden", "You are not linked to this child");

    const report = await generateParentReport({
      parentId: session.userId,
      childId: data.childId,
      type: data.type,
    });

    return ok({ report: report as ReportData });
  });

export const downloadReportPdfFn = createServerFn({ method: "POST" })
  .validator((d: unknown) => DownloadPdfSchema.parse(d))
  .handler(
    async ({
      data,
    }): Promise<
      Result<{ filename: string; contentType: "application/pdf"; base64: string }>
    > => {
      const session = await getUserSession();
      if (!session) return err("unauthorized", "Authentication required");

      if (!(await isStepUpFresh())) return err("step_up_required", "Password re-authentication required");

      const report = await db.query.parentReports.findFirst({
        where: eq(parentReports.id, data.reportId),
        with: {
          child: { columns: { name: true } },
        },
      });

      if (!report) return err("not_found", "Report not found");
      if (report.parentId !== session.userId)
        return err("forbidden", "Not authorized to view this report");

      const period = report.period ? (JSON.parse(report.period) as { start?: string; end?: string }) : {};
      const strengths = report.strengths ? (JSON.parse(report.strengths) as string[]) : [];
      const growthAreas = report.growthAreas ? (JSON.parse(report.growthAreas) as string[]) : [];
      const tips = report.tips ? (JSON.parse(report.tips) as ReportTip[]) : [];
      const badgeHighlights = report.badgeHighlights
        ? (JSON.parse(report.badgeHighlights) as string[])
        : [];

      const startDate = period.start ? new Date(period.start).toLocaleDateString() : "";
      const endDate = period.end ? new Date(period.end).toLocaleDateString() : "";

      const pdfData = {
        childName: report.child.name ?? "Your Child",
        period: `${startDate} - ${endDate}`,
        type: report.type,
        generatedAt: report.createdAt.toLocaleDateString(),
        summary: report.summary ?? "",
        strengths,
        growthAreas,
        tips,
        badgeHighlights,
      };

      const pdfBuffer = await renderToBuffer(
        <ParentReportPDF data={pdfData} />,
      );

      const childSlug = (report.child.name ?? "child").toLowerCase().replace(/\s+/g, "-");
      const filename = `katalis-report-${childSlug}-${report.type}.pdf`;

      return ok({
        filename,
        contentType: "application/pdf",
        base64: Buffer.from(pdfBuffer).toString("base64"),
      });
    },
  );

export const changeParentPasswordFn = createServerFn({ method: "POST" })
  .validator((d: unknown) => ChangePasswordSchema.parse(d))
  .handler(async ({ data }): Promise<Result<{ changed: true }>> => {
    const session = await getUserSession();
    if (!session) return err("unauthorized", "Authentication required");

    if (!(await isStepUpFresh())) return err("step_up_required", "Password re-authentication required");

    const passwordHash = await hashPassword(data.newPassword);
    await db.update(users).set({ passwordHash }).where(eq(users.id, session.userId));

    return ok({ changed: true as const });
  });

export const deleteChildDataFn = createServerFn({ method: "POST" })
  .validator((d: unknown) => DeleteChildDataSchema.parse(d))
  .handler(
    async ({ data }): Promise<Result<{ deleted: DeletionCounts; message: string }>> => {
      const session = await getUserSession();
      if (!session) return err("unauthorized", "Authentication required");

      if (!(await isStepUpFresh())) return err("step_up_required", "Password re-authentication required");

      const linked = await verifyParentChildLink(session.userId, data.childId);
      if (!linked) return err("forbidden", "Access denied");

      const summary = await db.transaction(async (tx) => {
        const childDiscoveries = await tx
          .select({ id: discoveries.id })
          .from(discoveries)
          .where(eq(discoveries.childId, data.childId));
        const discoveryIds = childDiscoveries.map((d) => d.id);

        const counts: DeletionCounts = {
          interestSignals: (
            await tx
              .select({ count: count() })
              .from(interestSignals)
              .where(eq(interestSignals.childId, data.childId))
          )[0].count,
          interestProfiles: (
            await tx
              .select({ count: count() })
              .from(childInterestProfiles)
              .where(eq(childInterestProfiles.childId, data.childId))
          )[0].count,
          missionAssessments: (
            await tx
              .select({ count: count() })
              .from(missionInterestAssessments)
              .where(eq(missionInterestAssessments.childId, data.childId))
          )[0].count,
          reflections: (
            await tx
              .select({ count: count() })
              .from(reflectionEntries)
              .where(eq(reflectionEntries.childId, data.childId))
          )[0].count,
          galleryEntries: (
            await tx
              .select({ count: count() })
              .from(galleryEntries)
              .where(eq(galleryEntries.childId, data.childId))
          )[0].count,
          childBadges: (
            await tx
              .select({ count: count() })
              .from(childBadges)
              .where(eq(childBadges.childId, data.childId))
          )[0].count,
          parentQuestFollows: (
            await tx
              .select({ count: count() })
              .from(parentQuestFollows)
              .where(eq(parentQuestFollows.childId, data.childId))
          )[0].count,
          discoveryRatings:
            discoveryIds.length > 0
              ? (
                  await tx
                    .select({ count: count() })
                    .from(discoveryRatings)
                    .where(inArray(discoveryRatings.discoveryId, discoveryIds))
                )[0].count
              : 0,
          quests: (
            await tx
              .select({ count: count() })
              .from(quests)
              .where(eq(quests.childId, data.childId))
          )[0].count,
          discoveries: discoveryIds.length,
        };

        await tx.delete(interestSignals).where(eq(interestSignals.childId, data.childId));
        await tx
          .delete(childInterestProfiles)
          .where(eq(childInterestProfiles.childId, data.childId));
        await tx
          .delete(missionInterestAssessments)
          .where(eq(missionInterestAssessments.childId, data.childId));
        await tx.delete(reflectionEntries).where(eq(reflectionEntries.childId, data.childId));
        await tx.delete(galleryEntries).where(eq(galleryEntries.childId, data.childId));
        await tx.delete(childBadges).where(eq(childBadges.childId, data.childId));
        await tx
          .delete(parentQuestFollows)
          .where(eq(parentQuestFollows.childId, data.childId));
        if (discoveryIds.length > 0) {
          await tx
            .delete(discoveryRatings)
            .where(inArray(discoveryRatings.discoveryId, discoveryIds));
        }
        // Cascade-deleted: missions, mentor sessions/messages, adjustments via Quest FK.
        await tx.delete(quests).where(eq(quests.childId, data.childId));
        await tx.delete(discoveries).where(eq(discoveries.childId, data.childId));

        await tx.update(children).set({ name: null }).where(eq(children.id, data.childId));

        return counts;
      });

      try {
        await createInterestAuditEvent({
          childId: data.childId,
          actorUserId: session.userId,
          eventType: "parent_full_data_deletion_requested",
          entityType: "child",
          entityId: data.childId,
          metadataJson: { reason: data.reason, deletedCounts: summary },
        });
      } catch (auditError) {
        // Deletion already committed; surface audit failure in logs but do not
        // propagate — the destructive work succeeded.
        console.error(
          `Audit event write failed after child ${data.childId} deletion:`,
          auditError,
        );
      }

      return ok({
        deleted: summary,
        message: "Child data deletion complete. Audit trail retained per policy.",
      });
    },
  );
