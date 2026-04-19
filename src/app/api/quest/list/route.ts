import { NextResponse } from "next/server";
import { getChildSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * GET /api/quest/list
 *
 * Returns all quests for the authenticated child, ordered by creation date (newest first).
 * Each quest includes a summary of mission progress.
 */
export async function GET() {
  try {
    const session = await getChildSession();
    if (!session) {
      return NextResponse.json(
        { error: "unauthorized", message: "Authentication required" },
        { status: 401 },
      );
    }

    const quests = await prisma.quest.findMany({
      where: { childId: session.childId },
      orderBy: { createdAt: "desc" },
      include: {
        missions: {
          orderBy: { day: "asc" },
          select: {
            day: true,
            title: true,
            status: true,
          },
        },
      },
    });

    const questList = quests.map((quest) => {
      const completedCount = quest.missions.filter(
        (m) => m.status === "completed",
      ).length;

      return {
        id: quest.id,
        dream: quest.dream,
        status: quest.status,
        createdAt: quest.createdAt.toISOString(),
        completedCount,
        totalMissions: quest.missions.length,
        missions: quest.missions.map((m) => ({
          day: m.day,
          title: m.title,
          status: m.status,
        })),
      };
    });

    return NextResponse.json({ quests: questList });
  } catch (error) {
    console.error("Quest list error:", error);
    return NextResponse.json(
      { error: "server_error", message: "Failed to fetch quests" },
      { status: 500 },
    );
  }
}
