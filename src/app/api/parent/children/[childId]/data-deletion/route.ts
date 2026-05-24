import { NextRequest, NextResponse } from "next/server";
import { eq, count, inArray } from "drizzle-orm";

import { getUserSession } from "@/lib/auth";
import { db } from "@/lib/db";
import {
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
import { verifyParentChildLink } from "@/lib/parent/link";
import { createInterestAuditEvent } from "@/lib/interests/repository";

/**
 * DELETE /api/parent/children/[childId]/data-deletion
 *
 * Full data deletion request for a child. Removes interest signals, profile
 * rows, mission interest assessments, mentor sessions + messages, reflection
 * entries, gallery entries, quests + missions, discoveries, and badge grants.
 * The Child row itself is kept (with name nulled) so the parent's
 * ParentChild link remains intact and an audit trail survives.
 *
 * Spec ref: Katalis.docx §8.3c — "Parents can request deletion at any time."
 *
 * NOTE: discovery artifacts in object storage are NOT removed here —
 * a follow-up cron sweeps storage by URL. The DB rows referencing them
 * are removed synchronously.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ childId: string }> },
) {
  try {
    const session = await getUserSession();
    if (!session) {
      return NextResponse.json(
        { error: "unauthorized", message: "Authentication required" },
        { status: 401 },
      );
    }

    const { childId } = await params;
    const linked = await verifyParentChildLink(session.userId, childId);
    if (!linked) {
      return NextResponse.json(
        { error: "forbidden", message: "Access denied" },
        { status: 403 },
      );
    }

    let reason: string | undefined;
    try {
      const body = (await request.json()) as { reason?: string };
      if (typeof body?.reason === "string") reason = body.reason.slice(0, 500);
    } catch {
      // Optional body.
    }

    const summary = await db.transaction(async (tx) => {
      // Collect discoveryIds for this child to delete ratings
      const childDiscoveries = await tx
        .select({ id: discoveries.id })
        .from(discoveries)
        .where(eq(discoveries.childId, childId));
      const discoveryIds = childDiscoveries.map((d) => d.id);

      const counts = {
        interestSignals: (
          await tx.select({ count: count() }).from(interestSignals).where(eq(interestSignals.childId, childId))
        )[0].count,
        interestProfiles: (
          await tx.select({ count: count() }).from(childInterestProfiles).where(eq(childInterestProfiles.childId, childId))
        )[0].count,
        missionAssessments: (
          await tx.select({ count: count() }).from(missionInterestAssessments).where(eq(missionInterestAssessments.childId, childId))
        )[0].count,
        reflections: (
          await tx.select({ count: count() }).from(reflectionEntries).where(eq(reflectionEntries.childId, childId))
        )[0].count,
        galleryEntries: (
          await tx.select({ count: count() }).from(galleryEntries).where(eq(galleryEntries.childId, childId))
        )[0].count,
        childBadges: (
          await tx.select({ count: count() }).from(childBadges).where(eq(childBadges.childId, childId))
        )[0].count,
        parentQuestFollows: (
          await tx.select({ count: count() }).from(parentQuestFollows).where(eq(parentQuestFollows.childId, childId))
        )[0].count,
        discoveryRatings: discoveryIds.length > 0
          ? (await tx.select({ count: count() }).from(discoveryRatings).where(inArray(discoveryRatings.discoveryId, discoveryIds)))[0].count
          : 0,
        quests: (
          await tx.select({ count: count() }).from(quests).where(eq(quests.childId, childId))
        )[0].count,
        discoveries: discoveryIds.length,
      };

      await tx.delete(interestSignals).where(eq(interestSignals.childId, childId));
      await tx.delete(childInterestProfiles).where(eq(childInterestProfiles.childId, childId));
      await tx.delete(missionInterestAssessments).where(eq(missionInterestAssessments.childId, childId));
      await tx.delete(reflectionEntries).where(eq(reflectionEntries.childId, childId));
      await tx.delete(galleryEntries).where(eq(galleryEntries.childId, childId));
      await tx.delete(childBadges).where(eq(childBadges.childId, childId));
      await tx.delete(parentQuestFollows).where(eq(parentQuestFollows.childId, childId));
      if (discoveryIds.length > 0) {
        await tx.delete(discoveryRatings).where(inArray(discoveryRatings.discoveryId, discoveryIds));
      }
      // Cascade-deleted: missions, mentor sessions/messages, adjustments via Quest FK.
      await tx.delete(quests).where(eq(quests.childId, childId));
      await tx.delete(discoveries).where(eq(discoveries.childId, childId));

      await tx.update(children).set({ name: null }).where(eq(children.id, childId));

      return counts;
    });

    try {
      await createInterestAuditEvent({
        childId,
        actorUserId: session.userId,
        eventType: "parent_full_data_deletion_requested",
        entityType: "child",
        entityId: childId,
        metadataJson: { reason, deletedCounts: summary },
      });
    } catch (auditError) {
      // Deletion already committed; surface the audit failure in logs but
      // don't 500 the request — the destructive work succeeded.
      console.error(
        `Audit event write failed after child ${childId} deletion:`,
        auditError,
      );
    }

    return NextResponse.json({
      ok: true,
      deleted: summary,
      message: "Child data deletion complete. Audit trail retained per policy.",
    });
  } catch (error) {
    console.error("Parent data deletion error:", error);
    return NextResponse.json(
      { error: "server_error", message: "Failed to delete child data" },
      { status: 500 },
    );
  }
}
