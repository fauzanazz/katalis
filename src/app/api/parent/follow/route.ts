import { NextResponse } from "next/server";
import { eq, desc, asc } from "drizzle-orm";
import { getUserSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { parentQuestFollows, missions } from "@/lib/schema";

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
    const follows = await db.query.parentQuestFollows.findMany({
      where: eq(parentQuestFollows.parentId, session.userId),
      with: {
        quest: {
          columns: { id: true, dream: true, status: true },
          with: {
            missions: {
              columns: { day: true, status: true },
              orderBy: asc(missions.day),
            },
          },
        },
        child: {
          columns: { id: true, name: true },
        },
      },
      orderBy: desc(parentQuestFollows.updatedAt),
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
