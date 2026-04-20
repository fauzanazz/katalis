import { NextRequest, NextResponse } from "next/server";
import { getChildSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { sanitizeInput } from "@/lib/sanitize";
import { SendMessageInputSchema } from "@/lib/ai/mentor-schemas";
import { mentorChat, detectFrustration } from "@/lib/ai/mentor";
import { buildBadgeContext, evaluateBadges, awardBadges } from "@/lib/badges";

/**
 * POST /api/mentor/message
 *
 * Sends a child message to the mentor and gets a Socratic response.
 * Automatically detects frustration and adapts the response.
 *
 * Body: { sessionId, content }
 * Send content="" to get a greeting message.
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

    // Allow empty content for greeting requests
    if (body.content === null || body.content === undefined) {
      body.content = "";
    }

    const parsed = SendMessageInputSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "invalid", message: parsed.error.issues[0]?.message ?? "Invalid request" },
        { status: 400 },
      );
    }

    const { sessionId, content } = parsed.data;
    const isGreeting = content === "";

    // Sanitize child message
    const sanitizedContent = isGreeting ? "" : sanitizeInput(content);

    // Fetch session with mission context
    const mentorSession = await prisma.mentorSession.findUnique({
      where: { id: sessionId },
      include: {
        messages: { orderBy: { createdAt: "asc" } },
        adjustments: true,
      },
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

    if (mentorSession.status !== "active") {
      return NextResponse.json(
        { error: "invalid_state", message: "Session is no longer active" },
        { status: 400 },
      );
    }

    // Fetch mission context
    const mission = await prisma.mission.findUnique({
      where: { id: mentorSession.missionId },
    });

    if (!mission) {
      return NextResponse.json(
        { error: "not_found", message: "Mission not found" },
        { status: 404 },
      );
    }

    // Parse JSON fields from mission
    const instructions: string[] = (() => {
      try { return JSON.parse(mission.instructions); } catch { return []; }
    })();
    const materials: string[] = (() => {
      try { return JSON.parse(mission.materials); } catch { return []; }
    })();

    // Check for active adjustment — use simplified instructions if present
    const activeAdjustment = mentorSession.adjustments[0];
    const activeInstructions = activeAdjustment
      ? (() => { try { return JSON.parse(activeAdjustment.simplifiedInstructions); } catch { return instructions; } })()
      : instructions;

    // Save child message (if not greeting)
    if (!isGreeting) {
      await prisma.mentorMessage.create({
        data: {
          sessionId,
          role: "child",
          content: sanitizedContent,
        },
      });
    }

    // Detect frustration
    const childMessages = mentorSession.messages
      .filter((m) => m.role === "child")
      .map((m) => m.content)
      .concat(isGreeting ? [] : [sanitizedContent]);

    const sessionDurationMinutes = (Date.now() - mentorSession.createdAt.getTime()) / 60_000;

    const frustrationLevel = detectFrustration({
      messageCount: mentorSession.messages.length + (isGreeting ? 0 : 1),
      childMessageCount: childMessages.length,
      sessionDurationMinutes,
      recentChildMessages: childMessages.slice(-5),
    });

    // Get mentor response
    const chatHistory = mentorSession.messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const mentorResponse = await mentorChat(
      isGreeting ? null : sanitizedContent,
      frustrationLevel,
      {
        day: mission.day,
        title: mission.title,
        description: mission.description,
        instructions: activeInstructions,
        materials,
      },
      chatHistory,
      isGreeting,
    );

    // Save mentor message
    const savedMentorMessage = await prisma.mentorMessage.create({
      data: {
        sessionId,
        role: "mentor",
        content: mentorResponse.message,
        meta: JSON.stringify({
          suggestions: mentorResponse.suggestions,
          frustrationLevel: mentorResponse.frustrationLevel ?? frustrationLevel,
          offerAdjustment: mentorResponse.offerAdjustment,
        }),
      },
    });

    // Check for trailblazer badge (first mentor chat usage)
    const badgeCtx = await buildBadgeContext({
      childId: session.childId,
      questId: mentorSession.questId,
    });
    const newBadgeSlugs = evaluateBadges(badgeCtx);
    const newBadges = await awardBadges({
      childId: session.childId,
      newlyEarnedSlugs: newBadgeSlugs,
      trigger: "mentor_message",
      questId: mentorSession.questId,
    });

    return NextResponse.json({
      message: {
        id: savedMentorMessage.id,
        role: "mentor",
        content: mentorResponse.message,
        suggestions: mentorResponse.suggestions,
        frustrationLevel: mentorResponse.frustrationLevel ?? frustrationLevel,
        offerAdjustment: mentorResponse.offerAdjustment,
        createdAt: savedMentorMessage.createdAt.toISOString(),
      },
      newBadges: newBadges.length > 0 ? newBadges : undefined,
    });
  } catch (error) {
    console.error("Mentor message error:", error);

    if (error instanceof Error && error.message.includes("timed out")) {
      return NextResponse.json(
        { error: "timeout", message: "Mentor is thinking too long. Please try again!" },
        { status: 504 },
      );
    }

    return NextResponse.json(
      { error: "server_error", message: "Failed to get mentor response" },
      { status: 500 },
    );
  }
}
