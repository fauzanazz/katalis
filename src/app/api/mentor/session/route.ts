import { NextRequest, NextResponse } from "next/server";
import { eq, asc, desc } from "drizzle-orm";
import { getChildSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { mentorSessions, missions, mentorMessages, adjustmentEvents } from "@/lib/schema";
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
    let mentorSession = await db.query.mentorSessions.findFirst({
      where: eq(mentorSessions.missionId, missionId),
      with: {
        messages: { orderBy: asc(mentorMessages.createdAt) },
        adjustments: { orderBy: desc(adjustmentEvents.createdAt) },
      },
    });

    if (!mentorSession) {
      // Auto-create if mission is in_progress and belongs to this child
      const mission = await db.query.missions.findFirst({
        where: eq(missions.id, missionId),
        with: { quest: true },
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

      await db.insert(mentorSessions).values({
        missionId,
        childId: session.childId,
        questId: mission.questId,
        status: "active",
      });

      mentorSession = await db.query.mentorSessions.findFirst({
        where: eq(mentorSessions.missionId, missionId),
        with: {
          messages: { orderBy: asc(mentorMessages.createdAt) },
          adjustments: { orderBy: desc(adjustmentEvents.createdAt) },
        },
      });
    }

    if (!mentorSession) {
      return NextResponse.json(
        { error: "server_error", message: "Failed to fetch mentor session" },
        { status: 500 },
      );
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
    const mission = await db.query.missions.findFirst({
      where: eq(missions.id, missionId),
      with: { quest: true },
    });

    if (!mission || mission.quest.id !== questId || mission.quest.childId !== session.childId) {
      return NextResponse.json(
        { error: "not_found", message: "Mission not found" },
        { status: 404 },
      );
    }

    // Check for existing session
    const existing = await db.query.mentorSessions.findFirst({
      where: eq(mentorSessions.missionId, missionId),
    });

    if (existing) {
      return NextResponse.json(
        { error: "exists", message: "Session already exists for this mission" },
        { status: 409 },
      );
    }

    const mentorSession = (
      await db
        .insert(mentorSessions)
        .values({
          missionId,
          childId: session.childId,
          questId,
          status: "active",
        })
        .returning()
    )[0];

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
