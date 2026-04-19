import { NextRequest, NextResponse } from "next/server";
import { getChildSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * POST /api/quest/[id]/abandon
 *
 * Abandons an active quest. Sets quest status to "abandoned"
 * and resets all mission statuses to "locked".
 * After abandonment, the child can start a new discovery/quest.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getChildSession();
    if (!session) {
      return NextResponse.json(
        { error: "unauthorized", message: "Authentication required" },
        { status: 401 },
      );
    }

    const { id: questId } = await params;

    // Fetch the quest
    const quest = await prisma.quest.findUnique({
      where: { id: questId },
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

    // Only active quests can be abandoned
    if (quest.status !== "active") {
      return NextResponse.json(
        {
          error: "invalid_state",
          message: `Cannot abandon a ${quest.status} quest`,
        },
        { status: 400 },
      );
    }

    // Abandon the quest in a transaction
    await prisma.$transaction(async (tx) => {
      // Update quest status
      await tx.quest.update({
        where: { id: questId },
        data: { status: "abandoned" },
      });

      // Reset all missions to locked
      await tx.mission.updateMany({
        where: { questId },
        data: { status: "locked" },
      });
    });

    return NextResponse.json({
      success: true,
      message: "Quest abandoned successfully",
    });
  } catch (error) {
    console.error("Quest abandon error:", error);
    return NextResponse.json(
      { error: "server_error", message: "Failed to abandon quest" },
      { status: 500 },
    );
  }
}
