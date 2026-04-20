import { NextRequest, NextResponse } from "next/server";
import { getChildSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AdjustmentInputSchema } from "@/lib/ai/mentor-schemas";
import { simplifyMission } from "@/lib/ai/mentor";

/**
 * POST /api/mentor/adjust
 *
 * Creates a "Small Adjustment" — simplified mission instructions.
 * Records the adjustment event and increments the session's adjustment count.
 *
 * Body: { sessionId, reason }
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

    const parsed = AdjustmentInputSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "invalid", message: parsed.error.issues[0]?.message ?? "Invalid request" },
        { status: 400 },
      );
    }

    const { sessionId, reason } = parsed.data;

    const mentorSession = await prisma.mentorSession.findUnique({
      where: { id: sessionId },
    });

    if (!mentorSession) {
      return NextResponse.json(
        { error: "not_found", message: "Session not found" },
        { status: 404 },
      );
    }

    if (mentorSession.childId !== session.childId) {
      return NextResponse.json(
        { error: "forbidden", message: "Access denied" },
        { status: 403 },
      );
    }

    // Limit adjustments per session (max 3)
    if (mentorSession.adjustmentCount >= 3) {
      return NextResponse.json(
        { error: "limit_reached", message: "Maximum adjustments reached for this mission" },
        { status: 400 },
      );
    }

    // Fetch mission
    const mission = await prisma.mission.findUnique({
      where: { id: mentorSession.missionId },
    });

    if (!mission) {
      return NextResponse.json(
        { error: "not_found", message: "Mission not found" },
        { status: 404 },
      );
    }

    const originalInstructions: string[] = (() => {
      try { return JSON.parse(mission.instructions); } catch { return []; }
    })();
    const materials: string[] = (() => {
      try { return JSON.parse(mission.materials); } catch { return []; }
    })();

    // Generate simplified instructions
    const simplified = await simplifyMission(
      originalInstructions,
      mission.title,
      materials,
    );

    // Save adjustment event + update session in transaction
    const result = await prisma.$transaction(async (tx) => {
      const adjustment = await tx.adjustmentEvent.create({
        data: {
          sessionId,
          missionId: mentorSession.missionId,
          originalInstructions: JSON.stringify(originalInstructions),
          simplifiedInstructions: JSON.stringify(simplified.simplifiedInstructions),
          reason,
        },
      });

      await tx.mentorSession.update({
        where: { id: sessionId },
        data: { adjustmentCount: { increment: 1 } },
      });

      return adjustment;
    });

    // Save encouragement message as a mentor message
    await prisma.mentorMessage.create({
      data: {
        sessionId,
        role: "mentor",
        content: simplified.encouragementMessage,
        meta: JSON.stringify({
          type: "adjustment",
          adjustmentId: result.id,
        }),
      },
    });

    return NextResponse.json({
      adjustment: {
        id: result.id,
        simplifiedInstructions: simplified.simplifiedInstructions,
        encouragementMessage: simplified.encouragementMessage,
        reason,
        createdAt: result.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("Mission adjustment error:", error);

    if (error instanceof Error && error.message.includes("timed out")) {
      return NextResponse.json(
        { error: "timeout", message: "Adjustment is taking too long. Please try again!" },
        { status: 504 },
      );
    }

    return NextResponse.json(
      { error: "server_error", message: "Failed to create adjustment" },
      { status: 500 },
    );
  }
}
