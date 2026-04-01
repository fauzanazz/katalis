import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { sanitizeInput } from "@/lib/sanitize";
import { QuestGenerationInputSchema } from "@/lib/ai/quest-schemas";
import { generateQuest } from "@/lib/ai/claude";
import { prisma } from "@/lib/db";

/**
 * POST /api/quest/generate
 *
 * Accepts dream text, local context, and optional talent data.
 * Generates a personalized 7-day quest via Claude AI (mocked for MVP).
 * Creates Quest and Mission records in the database.
 *
 * Request body: { dream: string, localContext: string, talents?: Array, discoveryId?: string }
 * Response:     { id: string, missions: Array<{ day, title, description, instructions, materials, tips }> }
 */
export async function POST(request: NextRequest) {
  try {
    // Require authentication
    const session = await getSession();
    if (!session?.childId) {
      return NextResponse.json(
        { error: "unauthorized", message: "Authentication required" },
        { status: 401 },
      );
    }

    // Parse request body
    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json(
        { error: "invalid", message: "Invalid request body" },
        { status: 400 },
      );
    }

    // Sanitize user text inputs unconditionally (XSS prevention)
    if (body.dream && typeof body.dream === "string") {
      body.dream = sanitizeInput(body.dream);
    }
    if (body.localContext && typeof body.localContext === "string") {
      body.localContext = sanitizeInput(body.localContext);
    }

    // Validate input with Zod
    const parsed = QuestGenerationInputSchema.safeParse(body);
    if (!parsed.success) {
      const message =
        parsed.error.issues[0]?.message ?? "Invalid request";
      return NextResponse.json(
        { error: "invalid", message },
        { status: 400 },
      );
    }

    const { dream, localContext, talents, discoveryId } = parsed.data;

    // Generate quest via Claude AI
    const result = await generateQuest({
      dream,
      localContext,
      talents,
      discoveryId,
    });

    // Create Quest and Mission records in database
    const quest = await prisma.quest.create({
      data: {
        childId: session.childId,
        discoveryId: discoveryId ?? null,
        dream,
        localContext,
        status: "active",
        generatedAt: new Date(),
        missions: {
          create: result.missions.map((mission) => ({
            day: mission.day,
            title: mission.title,
            description: mission.description,
            instructions: JSON.stringify(mission.instructions),
            materials: JSON.stringify(mission.materials),
            tips: JSON.stringify(mission.tips),
            status: mission.day === 1 ? "available" : "locked",
          })),
        },
      },
      include: {
        missions: {
          orderBy: { day: "asc" },
        },
      },
    });

    // Transform missions to include parsed JSON fields
    const missions = quest.missions.map((m) => ({
      day: m.day,
      title: m.title,
      description: m.description,
      instructions: JSON.parse(m.instructions) as string[],
      materials: JSON.parse(m.materials) as string[],
      tips: JSON.parse(m.tips) as string[],
      status: m.status,
    }));

    return NextResponse.json(
      { id: quest.id, missions },
      { status: 200 },
    );
  } catch (error) {
    console.error("Quest generation error:", error);

    // Check for timeout
    if (
      error instanceof Error &&
      error.message.includes("timed out")
    ) {
      return NextResponse.json(
        {
          error: "timeout",
          message:
            "Quest generation is taking too long. Please try again.",
        },
        { status: 504 },
      );
    }

    return NextResponse.json(
      {
        error: "ai_failure",
        message:
          "We couldn't create your quest right now. Please try again!",
      },
      { status: 500 },
    );
  }
}
