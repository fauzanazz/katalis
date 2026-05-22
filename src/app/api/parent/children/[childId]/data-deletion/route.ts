import { NextRequest, NextResponse } from "next/server";

import { getUserSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
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

    const summary = await prisma.$transaction(async (tx) => {
      const counts = {
        interestSignals: await tx.interestSignal.count({ where: { childId } }),
        interestProfiles: await tx.childInterestProfile.count({ where: { childId } }),
        missionAssessments: await tx.missionInterestAssessment.count({ where: { childId } }),
        reflections: await tx.reflectionEntry.count({ where: { childId } }),
        galleryEntries: await tx.galleryEntry.count({ where: { childId } }),
        childBadges: await tx.childBadge.count({ where: { childId } }),
        parentQuestFollows: await tx.parentQuestFollow.count({ where: { childId } }),
        discoveryRatings: await tx.discoveryRating.count({
          where: { discovery: { childId } },
        }),
        quests: await tx.quest.count({ where: { childId } }),
        discoveries: await tx.discovery.count({ where: { childId } }),
      };

      await tx.interestSignal.deleteMany({ where: { childId } });
      await tx.childInterestProfile.deleteMany({ where: { childId } });
      await tx.missionInterestAssessment.deleteMany({ where: { childId } });
      await tx.reflectionEntry.deleteMany({ where: { childId } });
      await tx.galleryEntry.deleteMany({ where: { childId } });
      await tx.childBadge.deleteMany({ where: { childId } });
      await tx.parentQuestFollow.deleteMany({ where: { childId } });
      await tx.discoveryRating.deleteMany({
        where: { discovery: { childId } },
      });
      // Cascade-deleted: missions, mentor sessions/messages, adjustments via Quest FK.
      await tx.quest.deleteMany({ where: { childId } });
      await tx.discovery.deleteMany({ where: { childId } });

      await tx.child.update({
        where: { id: childId },
        data: { name: null },
      });

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
