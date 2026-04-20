import { NextRequest, NextResponse } from "next/server";
import { getChildSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { CreateSessionInputSchema } from "@/lib/ai/mentor-schemas";

/**
 * GET /api/mentor/session?missionId=xxx
 *
 * Fetches the mentor session for a specific mission.
 * Creates one automatically if the mission is in_progress and no session exists.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getChildSession();
    if (!session) {
      return NextResponse.json(
        { error: "unauthorized", message: "Authentication required" },
        { status: 401 },
      );
    }

    const missionId = request.nextUrl.searchParams.get("missionId");
    if (!missionId) {
      return NextResponse.json(
        { error: "invalid", message: "missionId is required" },
        { status: 400 },
      );
    }

    // Find or create mentor session
    let mentorSession = await prisma.mentorSession.findUnique({
      where: { missionId },
      include: {
        messages: { orderBy: { createdAt: "asc" } },
        adjustments: { orderBy: { createdAt: "desc" } },
      },
    });

    if (!mentorSession) {
      // Auto-create if mission is in_progress and belongs to this child
      const mission = await prisma.mission.findUnique({
        where: { id: missionId },
        include: { quest: true },
      });

      if (!mission || mission.quest.childId !== session.childId) {
        return NextResponse.json(
          { error: "not_found", message: "Mission not found" },
          { status: 404 },
        );
      }

      if (mission.status !== "in_progress") {
        return NextResponse.json(
          { error: "invalid_state", message: "Mission must be in progress to start mentor chat" },
          { status: 400 },
        );
      }

      mentorSession = await prisma.mentorSession.create({
        data: {
          missionId,
          childId: session.childId,
          questId: mission.questId,
          status: "active",
        },
        include: {
          messages: { orderBy: { createdAt: "asc" } },
          adjustments: { orderBy: { createdAt: "desc" } },
        },
      });
    }

    // Verify ownership
    if (mentorSession.childId !== session.childId) {
      return NextResponse.json(
        { error: "forbidden", message: "Access denied" },
        { status: 403 },
      );
    }

    return NextResponse.json({
      id: mentorSession.id,
      missionId: mentorSession.missionId,
      status: mentorSession.status,
      adjustmentCount: mentorSession.adjustmentCount,
      messages: mentorSession.messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        meta: m.meta ? JSON.parse(m.meta) : null,
        createdAt: m.createdAt.toISOString(),
      })),
      adjustments: mentorSession.adjustments.map((a) => ({
        id: a.id,
        reason: a.reason,
        simplifiedInstructions: JSON.parse(a.simplifiedInstructions),
        createdAt: a.createdAt.toISOString(),
      })),
      createdAt: mentorSession.createdAt.toISOString(),
    });
  } catch (error) {
    console.error("Mentor session GET error:", error);
    return NextResponse.json(
      { error: "server_error", message: "Failed to fetch mentor session" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/mentor/session
 *
 * Explicitly create a mentor session for a mission.
 * Body: { questId, missionId }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getChildSession();
    if (!session) {
      return NextResponse.json(
        { error: "unauthorized", message: "Authentication required" },
        { status: 401 },
      );
    }

    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json(
        { error: "invalid", message: "Invalid request body" },
        { status: 400 },
      );
    }

    const parsed = CreateSessionInputSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "invalid", message: parsed.error.issues[0]?.message ?? "Invalid request" },
        { status: 400 },
      );
    }

    const { questId, missionId } = parsed.data;

    // Verify mission exists and belongs to child
    const mission = await prisma.mission.findUnique({
      where: { id: missionId },
      include: { quest: true },
    });

    if (!mission || mission.quest.id !== questId || mission.quest.childId !== session.childId) {
      return NextResponse.json(
        { error: "not_found", message: "Mission not found" },
        { status: 404 },
      );
    }

    // Check for existing session
    const existing = await prisma.mentorSession.findUnique({
      where: { missionId },
    });

    if (existing) {
      return NextResponse.json(
        { error: "exists", message: "Session already exists for this mission" },
        { status: 409 },
      );
    }

    const mentorSession = await prisma.mentorSession.create({
      data: {
        missionId,
        childId: session.childId,
        questId,
        status: "active",
      },
    });

    return NextResponse.json({
      id: mentorSession.id,
      missionId: mentorSession.missionId,
      status: mentorSession.status,
      createdAt: mentorSession.createdAt.toISOString(),
    }, { status: 201 });
  } catch (error) {
    console.error("Mentor session POST error:", error);
    return NextResponse.json(
      { error: "server_error", message: "Failed to create mentor session" },
      { status: 500 },
    );
  }
}
