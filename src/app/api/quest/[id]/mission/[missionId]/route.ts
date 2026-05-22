import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getChildSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { sanitizeInput } from "@/lib/sanitize";
import { isAllowedStorageUrl } from "@/lib/url-allowlist";
import { buildBadgeContext, evaluateBadges, awardBadges } from "@/lib/badges";
import { mapMissionCompletionToInterestSignals } from "@/lib/interests/quest-mapper";
import { ingestInterestSignals } from "@/lib/interests/ingest-service";
import {
  applyAssessmentToSignals,
  assessMissionEngagement,
  type MissionEngagementMetrics,
} from "@/lib/interests/mission-reassessment";
import { recordZpdEvent } from "@/lib/zpd";

/**
 * Zod schema for mission status update requests.
 */
const MissionUpdateSchema = z.object({
  action: z.enum(["start", "complete"]),
  proofPhotoUrl: z.string().url().optional(),
});

const FRUSTRATION_RANK = { none: 0, low: 1, medium: 2, high: 3 } as const;
type FrustrationKey = keyof typeof FRUSTRATION_RANK;

/**
 * Extract the peak `frustrationLevel` reported across the session's mentor
 * messages. Each mentor message's `meta` is a JSON string holding the
 * frustration the response was generated under.
 */
function extractPeakFrustration(
  messages: Array<{ meta: string | null; role: string }>,
): FrustrationKey {
  let peak: FrustrationKey = "none";
  for (const m of messages) {
    if (m.role !== "mentor" || !m.meta) continue;
    try {
      const parsed = JSON.parse(m.meta) as { frustrationLevel?: string };
      const level = parsed.frustrationLevel;
      if (level && level in FRUSTRATION_RANK) {
        if (FRUSTRATION_RANK[level as FrustrationKey] > FRUSTRATION_RANK[peak]) {
          peak = level as FrustrationKey;
        }
      }
    } catch {
      // Ignore malformed meta — never let parse error block reassessment.
    }
  }
  return peak;
}

/**
 * PATCH /api/quest/[id]/mission/[missionId]
 *
 * Updates a mission's status. Supports two actions:
 * - "start": transitions available → in_progress
 * - "complete": transitions in_progress → completed (requires proofPhotoUrl)
 *
 * Enforces sequential progression: completing Day N unlocks Day N+1.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; missionId: string }> },
) {
  try {
    const session = await getChildSession();
    if (!session) {
      return NextResponse.json(
        { error: "unauthorized", message: "Authentication required" },
        { status: 401 },
      );
    }

    const { id: questId, missionId } = await params;

    // Parse request body
    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json(
        { error: "invalid", message: "Invalid request body" },
        { status: 400 },
      );
    }

    const parsed = MissionUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "invalid",
          message:
            parsed.error.issues[0]?.message ?? "Invalid request",
        },
        { status: 400 },
      );
    }

    const { action } = parsed.data;
    let { proofPhotoUrl } = parsed.data;

    // Sanitize URL input unconditionally (XSS prevention + URL origin check)
    if (proofPhotoUrl && typeof proofPhotoUrl === "string") {
      proofPhotoUrl = sanitizeInput(proofPhotoUrl);

      if (!isAllowedStorageUrl(proofPhotoUrl)) {
        return NextResponse.json(
          { error: "invalid", message: "Invalid proof photo URL" },
          { status: 400 },
        );
      }
    }

    // Fetch the quest with all missions
    const quest = await prisma.quest.findUnique({
      where: { id: questId },
      include: {
        missions: { orderBy: { day: "asc" } },
      },
    });

    if (!quest) {
      return NextResponse.json(
        { error: "not_found", message: "Quest not found" },
        { status: 404 },
      );
    }

    // Verify ownership
    if (quest.childId !== session.childId) {
      return NextResponse.json(
        { error: "forbidden", message: "Access denied" },
        { status: 403 },
      );
    }

    // Check quest is active (not abandoned or completed)
    if (quest.status !== "active") {
      return NextResponse.json(
        {
          error: "invalid_state",
          message: `Cannot modify missions on a ${quest.status} quest`,
        },
        { status: 400 },
      );
    }

    // Find the target mission
    const mission = quest.missions.find((m) => m.id === missionId);
    if (!mission) {
      return NextResponse.json(
        { error: "not_found", message: "Mission not found" },
        { status: 404 },
      );
    }

    // Handle "start" action
    if (action === "start") {
      if (mission.status !== "available") {
        return NextResponse.json(
          {
            error: "invalid_state",
            message: `Cannot start a mission with status "${mission.status}". Only "available" missions can be started.`,
          },
          { status: 400 },
        );
      }

      const updatedMission = await prisma.mission.update({
        where: { id: missionId },
        data: { status: "in_progress" },
      });

      // Auto-create mentor session for this mission
      await prisma.mentorSession.upsert({
        where: { missionId },
        create: {
          missionId,
          childId: session.childId,
          questId,
          status: "active",
        },
        update: {},
      });

      return NextResponse.json({
        success: true,
        mission: {
          id: updatedMission.id,
          day: updatedMission.day,
          status: updatedMission.status,
        },
      });
    }

    // Handle "complete" action
    if (action === "complete") {
      if (mission.status !== "in_progress") {
        return NextResponse.json(
          {
            error: "invalid_state",
            message: `Cannot complete a mission with status "${mission.status}". Only "in_progress" missions can be completed.`,
          },
          { status: 400 },
        );
      }

      // Proof photo is required
      if (!proofPhotoUrl) {
        return NextResponse.json(
          {
            error: "missing_proof",
            message:
              "A proof photo is required to complete the mission.",
          },
          { status: 400 },
        );
      }

      // Complete the mission and unlock the next day in a transaction
      const result = await prisma.$transaction(async (tx) => {
        // Update current mission to completed
        const completedMission = await tx.mission.update({
          where: { id: missionId },
          data: {
            status: "completed",
            proofPhotoUrl,
          },
        });

        // Find and unlock the next day's mission
        const nextMission = quest.missions.find(
          (m) => m.day === mission.day + 1,
        );

        if (nextMission && nextMission.status === "locked") {
          await tx.mission.update({
            where: { id: nextMission.id },
            data: { status: "available" },
          });
        }

        // Check if all missions are completed
        const allMissions = await tx.mission.findMany({
          where: { questId },
          select: { status: true },
        });

        const allCompleted = allMissions.every(
          (m) => m.status === "completed",
        );

        // If all completed, update quest status
        if (allCompleted) {
          await tx.quest.update({
            where: { id: questId },
            data: { status: "completed" },
          });
        }

        return {
          completedMission,
          nextDayUnlocked: nextMission
            ? nextMission.status === "locked"
            : false,
          questCompleted: allCompleted,
        };
      });

      // Check for newly earned badges
      const badgeCtx = await buildBadgeContext({
        childId: session.childId,
        questId,
      });
      const newBadgeSlugs = evaluateBadges(badgeCtx);
      const newBadges = await awardBadges({
        childId: session.childId,
        newlyEarnedSlugs: newBadgeSlugs,
        trigger: "mission_complete",
        questId,
      });

      // Reassess interest prediction vs actual engagement (spec §6.2).
      // Fetches mentor session frustration peak + adjustment count, then
      // scales each predicted signal's strength and emits a frustration
      // counter-signal when the prediction was contradicted by behavior.
      try {
        const mentorSession = await prisma.mentorSession.findUnique({
          where: { missionId },
          include: {
            messages: { select: { meta: true, role: true } },
            adjustments: { select: { id: true } },
          },
        });
        const peakFrustration = mentorSession
          ? extractPeakFrustration(mentorSession.messages)
          : "none";
        const metrics: MissionEngagementMetrics = {
          completed: true,
          adjustmentCount: mentorSession?.adjustments.length ?? 0,
          peakFrustration,
        };
        const assessment = assessMissionEngagement(metrics);

        const missionSignals = mapMissionCompletionToInterestSignals({
          quest: { dream: quest.dream, localContext: quest.localContext },
          mission: { title: mission.title, description: mission.description },
        });
        if (missionSignals.length > 0) {
          const adjustedSignals = applyAssessmentToSignals(missionSignals, assessment);
          await ingestInterestSignals({
            childId: session.childId,
            source: "mission_completed",
            questId,
            missionId,
            signals: adjustedSignals,
          });
        }
      } catch (interestError) {
        console.error("Interest reassessment failed for mission completion, continuing:", interestError);
      }

      // Record ZPD event (fire-and-forget — failure must not break completion)
      try {
        await recordZpdEvent({
          childId: session.childId,
          outcome: "completion",
          missionId,
        });
      } catch (zpdError) {
        console.error("ZPD event recording failed for mission completion, continuing:", zpdError);
      }

      return NextResponse.json({
        success: true,
        mission: {
          id: result.completedMission.id,
          day: result.completedMission.day,
          status: result.completedMission.status,
          proofPhotoUrl: result.completedMission.proofPhotoUrl,
        },
        nextDayUnlocked: result.nextDayUnlocked,
        questCompleted: result.questCompleted,
        newBadges: newBadges.length > 0 ? newBadges : undefined,
      });
    }

    return NextResponse.json(
      { error: "invalid", message: "Invalid action" },
      { status: 400 },
    );
  } catch (error) {
    console.error("Mission update error:", error);
    return NextResponse.json(
      { error: "server_error", message: "Failed to update mission" },
      { status: 500 },
    );
  }
}
