import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getChildSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { sanitizeInput } from "@/lib/sanitize";
import { isAllowedStorageUrl } from "@/lib/url-allowlist";

/**
 * Zod schema for mission status update requests.
 */
const MissionUpdateSchema = z.object({
  action: z.enum(["start", "complete"]),
  proofPhotoUrl: z.string().url().optional(),
});

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
