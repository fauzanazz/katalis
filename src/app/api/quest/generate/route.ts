import { NextRequest, NextResponse } from "next/server";
import { eq, desc, count } from "drizzle-orm";
import { getChildSession } from "@/lib/auth";
import { sanitizeInput } from "@/lib/sanitize";
import { QuestGenerationInputSchema } from "@/lib/ai/quest-schemas";
import { generateQuest } from "@/lib/ai/client";
import { db } from "@/lib/db";
import { children, childInterestProfiles, discoveries, quests, missions } from "@/lib/schema";
import { moderateContent } from "@/lib/moderation";
import { mapQuestToInterestSignals } from "@/lib/interests/quest-mapper";
import { ingestInterestSignals } from "@/lib/interests/ingest-service";
import { getZpdScore } from "@/lib/zpd";
import { getAgeGroup } from "@/lib/age";
import {
  buildAgeConstraintPromptFragment,
  clampOrRejectMissions,
} from "@/lib/ai/quest/age-caps";
import {
  pickExplorationInterests,
  shouldIncludeExploration,
  type ProfileSummary,
} from "@/lib/ai/quest/exploration";
import { isInterestKey } from "@/lib/interests/taxonomy";
import { mapToGardner } from "@/lib/ai/kidsartbench-schemas";
import type { KidsArtBenchScore } from "@/lib/ai/kidsartbench-schemas";

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

    const { dream, localContext, talents, discoveryId, guestDob } = parsed.data;

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

    // Resolve child age band (drives mission duration caps). Authed children
    // resolve DoB from DB; guests pass guestDob in the body.
    let ageGroup: ReturnType<typeof getAgeGroup>["band"] = "unknown";
    if (session?.childId) {
      const child = await db.query.children.findFirst({
        where: eq(children.id, session.childId),
        columns: { dateOfBirth: true },
      });
      ageGroup = getAgeGroup(child?.dateOfBirth).band;
    } else if (guestDob) {
      ageGroup = getAgeGroup(new Date(guestDob)).band;
    }

    // Pygmalion safeguard (§8.1b): periodically inject interest keys outside
    // the child's top set so the generator includes an exploration mission.
    let explorationInterests: string[] | undefined;
    if (session?.childId) {
      const profileRows = (await db.query.childInterestProfiles.findMany({
        where: eq(childInterestProfiles.childId, session.childId),
        orderBy: desc(childInterestProfiles.score),
        limit: 20,
        columns: { interestKey: true, score: true },
      })) as Array<{ interestKey: string; score: number }>;
      const validProfiles: ProfileSummary[] = profileRows.flatMap((p) =>
        isInterestKey(p.interestKey)
          ? [{ interestKey: p.interestKey, score: p.score }]
          : [],
      );
      if (shouldIncludeExploration(validProfiles)) {
        explorationInterests = pickExplorationInterests(validProfiles);
      }
    }

    // Enrich quest generation with Gardner intelligence profile from artwork analysis
    let artworkSignals:
      | { gardnerScores: Record<string, number>; dominantIntelligences: string[] }
      | undefined;
    if (discoveryId && session?.childId) {
      try {
        const discovery = await db.query.discoveries.findFirst({
          where: eq(discoveries.id, discoveryId),
          columns: { aiAnalysis: true },
        });
        if (discovery?.aiAnalysis) {
          const analysisJson = JSON.parse(discovery.aiAnalysis) as {
            kidsArtBench?: KidsArtBenchScore;
          };
          if (analysisJson.kidsArtBench) {
            const gardnerScores = mapToGardner(analysisJson.kidsArtBench);
            const dominantIntelligences = Object.entries(gardnerScores)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 3)
              .map(([k]) => k);
            artworkSignals = { gardnerScores, dominantIntelligences };
          }
        }
      } catch {
        // Non-fatal — proceed without artwork signals
      }
    }

    // Generate quest; validate per-band duration cap; retry once on violation.
    let result = await generateQuest({
      dream,
      localContext,
      talents,
      discoveryId,
      zpdScore,
      ageGroup,
      explorationInterests,
      artworkSignals,
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
        explorationInterests,
        artworkSignals,
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
    const [discoveryCountRow] = await db
      .select({ count: count() })
      .from(discoveries)
      .where(eq(discoveries.childId, session.childId));

    if (discoveryCountRow.count === 0) {
      return NextResponse.json(
        {
          error: "no_discovery",
          message:
            "You need to complete a talent discovery before creating a quest.",
        },
        { status: 400 },
      );
    }

    // Create Quest record
    const [quest] = await db.insert(quests).values({
      childId: session.childId,
      discoveryId: discoveryId ?? null,
      dream,
      localContext,
      status: "active",
      generatedAt: new Date(),
    }).returning();

    // Create Mission records
    await db.insert(missions).values(
      result.missions.map((mission) => ({
        questId: quest.id,
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
      }))
    );

    const missionList = await db.query.missions.findMany({
      where: eq(missions.questId, quest.id),
      orderBy: missions.day,
    });

    // Transform missions to include parsed JSON fields
    const missionResponse = missionList.map((m) => ({
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
      { id: quest.id, missions: missionResponse },
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
