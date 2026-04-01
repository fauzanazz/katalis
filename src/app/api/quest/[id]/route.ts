import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * GET /api/quest/[id]
 *
 * Returns a quest with all its missions.
 * Requires authentication. Only returns quests belonging to the authenticated child.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSession();
    if (!session?.childId) {
      return NextResponse.json(
        { error: "unauthorized", message: "Authentication required" },
        { status: 401 },
      );
    }

    const { id } = await params;

    const quest = await prisma.quest.findUnique({
      where: { id },
      include: {
        missions: {
          orderBy: { day: "asc" },
        },
        discovery: true,
      },
    });

    if (!quest) {
      return NextResponse.json(
        { error: "not_found", message: "Quest not found" },
        { status: 404 },
      );
    }

    // Only allow access to own quests
    if (quest.childId !== session.childId) {
      return NextResponse.json(
        { error: "forbidden", message: "Access denied" },
        { status: 403 },
      );
    }

    // Transform missions to include parsed JSON fields
    const missions = quest.missions.map((m) => ({
      id: m.id,
      day: m.day,
      title: m.title,
      description: m.description,
      instructions: safeParseJSON(m.instructions, []),
      materials: safeParseJSON(m.materials, []),
      tips: safeParseJSON(m.tips, []),
      status: m.status,
      proofPhotoUrl: m.proofPhotoUrl,
    }));

    // Count completed missions for progress
    const completedCount = missions.filter(
      (m) => m.status === "completed",
    ).length;

    // Get detected talents from discovery
    const detectedTalents = quest.discovery?.detectedTalents
      ? safeParseJSON(quest.discovery.detectedTalents, [])
      : [];

    return NextResponse.json({
      id: quest.id,
      dream: quest.dream,
      localContext: quest.localContext,
      status: quest.status,
      generatedAt: quest.generatedAt?.toISOString() ?? null,
      createdAt: quest.createdAt.toISOString(),
      missions,
      completedCount,
      totalMissions: missions.length,
      detectedTalents,
    });
  } catch (error) {
    console.error("Quest fetch error:", error);
    return NextResponse.json(
      { error: "server_error", message: "Failed to fetch quest" },
      { status: 500 },
    );
  }
}

function safeParseJSON<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
