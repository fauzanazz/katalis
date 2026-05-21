import { NextRequest, NextResponse } from "next/server";
import { getChildSession } from "@/lib/auth";
import { sanitizeInput } from "@/lib/sanitize";
import { QuestGenerationInputSchema } from "@/lib/ai/quest-schemas";
import { generateQuest } from "@/lib/ai/client";
import { prisma } from "@/lib/db";
import { moderateContent } from "@/lib/moderation";
import { mapQuestToInterestSignals } from "@/lib/interests/quest-mapper";
import { ingestInterestSignals } from "@/lib/interests/ingest-service";
import { getZpdScore } from "@/lib/zpd";
import { getAgeGroup } from "@/lib/age";
import {
  buildAgeConstraintPromptFragment,
  clampOrRejectMissions,
} from "@/lib/ai/quest/age-caps";

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
    // Auth is optional — guests get a preview without DB persistence
    const session = await getChildSession();

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

    // Moderate dream and context text for child safety
    const combinedText = `${dream} ${localContext}`;
    const moderationResult = await moderateContent({
      content: combinedText,
      contentType: "text",
      sourceType: "quest",
      childId: session?.childId,
    });

    if (!moderationResult.allowed) {
      return NextResponse.json(
        {
          error: "content_blocked",
          message:
            moderationResult.redirectMessage ??
            "This content cannot be processed. Let's try something else!",
          redirect: true,
        },
        { status: 200 },
      );
    }

    // Read ZPD anchor for this child (default baseline for guests / first-time)
    const zpdScore = session
      ? await getZpdScore(session.childId)
      : undefined;

    // Resolve child age band (drives mission duration caps)
    let ageGroup: ReturnType<typeof getAgeGroup>["band"] = "unknown";
    if (session?.childId) {
      const child = await prisma.child.findUnique({
        where: { id: session.childId },
        select: { dateOfBirth: true },
      });
      ageGroup = getAgeGroup(child?.dateOfBirth).band;
    }

    // Generate quest; validate per-band duration cap; retry once on violation.
    let result = await generateQuest({
      dream,
      localContext,
      talents,
      discoveryId,
      zpdScore,
      ageGroup,
    });

    let cap = clampOrRejectMissions(result.missions, ageGroup);
    if (!cap.ok) {
      const stricterContext = `${localContext}\n\n${buildAgeConstraintPromptFragment(ageGroup)}`;
      result = await generateQuest({
        dream,
        localContext: stricterContext,
        talents,
        discoveryId,
        zpdScore,
        ageGroup,
      });
      cap = clampOrRejectMissions(result.missions, ageGroup);
      if (!cap.ok) {
        console.error("Quest generation exceeded age-band duration cap after retry:", cap.reason);
        return NextResponse.json(
          {
            error: "ai_failure",
            message:
              "We couldn't tailor a quest for this age right now. Please try again!",
          },
          { status: 502 },
        );
      }
    }

    // Guest path: skip DB and return preview only
    if (!session) {
      const guestMissions = result.missions.map((mission) => ({
        day: mission.day,
        title: mission.title,
        description: mission.description,
        instructions: mission.instructions,
        materials: mission.materials,
        tips: mission.tips,
        estimatedMinutes: mission.estimatedMinutes,
        status: mission.day === 1 ? "available" : "locked",
      }));
      return NextResponse.json(
        { missions: guestMissions, guest: true },
        { status: 200 },
      );
    }

    // Authenticated path: verify discovery exists then persist
    const discoveryCount = await prisma.discovery.count({
      where: { childId: session.childId },
    });

    if (discoveryCount === 0) {
      return NextResponse.json(
        {
          error: "no_discovery",
          message:
            "You need to complete a talent discovery before creating a quest.",
        },
        { status: 400 },
      );
    }

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
            phase: mission.phase ?? null,
            intensityHint: mission.intensityHint ?? null,
            intent: mission.intent ?? null,
            estimatedMinutes: mission.estimatedMinutes,
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
      estimatedMinutes: m.estimatedMinutes,
    }));

    // Ingest quest-started interest signals (fire-and-forget)
    try {
      const signals = mapQuestToInterestSignals({ dream, localContext, talents });
      if (signals.length > 0) {
        await ingestInterestSignals({
          childId: session.childId,
          source: "quest_started",
          questId: quest.id,
          signals,
        });
      }
    } catch (interestError) {
      console.error("Interest ingestion failed for quest generation, continuing:", interestError);
    }

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
