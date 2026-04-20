import { NextRequest, NextResponse } from "next/server";
import { getChildSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { sanitizeInput } from "@/lib/sanitize";
import { isAllowedStorageUrl } from "@/lib/url-allowlist";
import { ReflectionInputSchema } from "@/lib/ai/mentor-schemas";
import { summarizeReflection } from "@/lib/ai/mentor";

/**
 * POST /api/reflection/daily
 *
 * Save a child's daily reflection and generate an AI summary.
 * Supports both text and voice reflections.
 *
 * Body: { questId, missionDay, type, content, fileUrl? }
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

    const parsed = ReflectionInputSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "invalid", message: parsed.error.issues[0]?.message ?? "Invalid request" },
        { status: 400 },
      );
    }

    const { questId, missionDay, type, content, fileUrl } = parsed.data;

    // Verify quest ownership
    const quest = await prisma.quest.findUnique({
      where: { id: questId },
    });

    if (!quest || quest.childId !== session.childId) {
      return NextResponse.json(
        { error: "not_found", message: "Quest not found" },
        { status: 404 },
      );
    }

    // Validate voice URL if provided
    const sanitizedContent = sanitizeInput(content);
    let sanitizedFileUrl: string | undefined;

    if (fileUrl) {
      sanitizedFileUrl = sanitizeInput(fileUrl);
      if (!isAllowedStorageUrl(sanitizedFileUrl)) {
        return NextResponse.json(
          { error: "invalid", message: "Invalid file URL" },
          { status: 400 },
        );
      }
    }

    // Check for duplicate reflection (one per mission day per quest)
    const existing = await prisma.reflectionEntry.findFirst({
      where: { childId: session.childId, questId, missionDay },
    });

    if (existing) {
      return NextResponse.json(
        { error: "exists", message: "Reflection already exists for this mission day" },
        { status: 409 },
      );
    }

    // Get mission title for context
    const mission = await prisma.mission.findFirst({
      where: { questId, day: missionDay },
    });

    const missionTitle = mission?.title ?? `Day ${missionDay}`;

    // Generate AI summary
    const aiSummary = await summarizeReflection(
      sanitizedContent,
      missionDay,
      missionTitle,
    );

    // Save reflection
    const reflection = await prisma.reflectionEntry.create({
      data: {
        childId: session.childId,
        questId,
        missionDay,
        type,
        content: sanitizedContent,
        fileUrl: sanitizedFileUrl,
        aiSummary: JSON.stringify(aiSummary),
      },
    });

    return NextResponse.json({
      id: reflection.id,
      missionDay,
      type,
      aiSummary,
      createdAt: reflection.createdAt.toISOString(),
    }, { status: 201 });
  } catch (error) {
    console.error("Reflection error:", error);

    if (error instanceof Error && error.message.includes("timed out")) {
      return NextResponse.json(
        { error: "timeout", message: "Reflection summary is taking too long. Please try again!" },
        { status: 504 },
      );
    }

    return NextResponse.json(
      { error: "server_error", message: "Failed to save reflection" },
      { status: 500 },
    );
  }
}
