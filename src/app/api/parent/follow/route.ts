import { NextResponse } from "next/server";
import { getUserSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * GET /api/parent/follow
 *
 * Get all quests the parent is following.
 */
export async function GET() {
  const session = await getUserSession();
  if (!session) {
    return NextResponse.json(
      { error: "unauthorized", message: "Authentication required" },
      { status: 401 },
    );
  }

  try {
    const follows = await prisma.parentQuestFollow.findMany({
      where: { parentId: session.userId },
      include: {
        quest: {
          select: {
            id: true,
            dream: true,
            status: true,
            missions: {
              select: { day: true, status: true },
              orderBy: { day: "asc" },
            },
          },
        },
        child: {
          select: { id: true, name: true },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    const formattedFollows = follows.map((f) => ({
      id: f.id,
      questId: f.questId,
      childId: f.childId,
      childName: f.child.name,
      dream: f.quest.dream,
      status: f.quest.status,
      currentDay: f.currentDay,
      lastViewedAt: f.lastViewedAt.toISOString(),
      missions: f.quest.missions,
      completedCount: f.quest.missions.filter((m) => m.status === "completed").length,
      totalCount: f.quest.missions.length,
    }));

    return NextResponse.json({ follows: formattedFollows });
  } catch (error) {
    console.error("Parent follows fetch error:", error);
    return NextResponse.json(
      { error: "server_error", message: "Failed to fetch follows" },
      { status: 500 },
    );
  }
}
