import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getChildSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { children } from "@/lib/schema";
import { sanitizeInput } from "@/lib/sanitize";
import { StoryAnalysisInputSchema } from "@/lib/ai/story-schemas";
import { analyzeStory } from "@/lib/ai/client";
import { moderateContent, getUncertaintyFallback } from "@/lib/moderation";
import { bandForDob, isModalityAllowed } from "@/lib/discover/age-modality";
import { checkRateLimit } from "@/lib/rate-limit";

const GUEST_ANALYZE_LIMIT = 2;
const GUEST_ANALYZE_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

function getClientIp(request: NextRequest): string {
  return (
    (request.headers.get("x-forwarded-for") ?? "")
      .split(",")[0]
      ?.trim() || "unknown"
  );
}

/**
 * POST /api/discovery/analyze-story
 *
 * Accepts a child's story text, image IDs, and submission type,
 * runs Claude narrative analysis, and returns detected talents
 * with detailed reasoning.
 *
 * Request body: { storyText: string, imageIds: string[], submissionType: "text" | "audio" }
 * Response:     { talents: Array<{ name, confidence, reasoning }> }
 */
export async function POST(request: NextRequest) {
  try {
    // Auth is optional — guests can analyze without a session
    const session = await getChildSession();

    // IP-based rate limit for unauthenticated guests (max 2 per 24 h)
    if (!session?.childId) {
      const ip = getClientIp(request);
      const rl = await checkRateLimit(`analyze:${ip}`, "guest-analyze", {
        maxAttempts: GUEST_ANALYZE_LIMIT,
        windowMs: GUEST_ANALYZE_WINDOW_MS,
      });
      if (rl.limited) {
        return NextResponse.json(
          { error: "guest_limit_reached", message: "Guest analysis limit reached. Create a free account to keep discovering!" },
          { status: 429 },
        );
      }
    }

    // Parse request body
    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json(
        { error: "invalid", message: "Invalid request body" },
        { status: 400 },
      );
    }

    // Sanitize story text unconditionally to prevent XSS
    if (body.storyText && typeof body.storyText === "string") {
      body.storyText = sanitizeInput(body.storyText);
    }

    // Validate input with Zod
    const parsed = StoryAnalysisInputSchema.safeParse(body);
    if (!parsed.success) {
      const message =
        parsed.error.issues[0]?.message ?? "Invalid request";
      return NextResponse.json(
        { error: "invalid", message },
        { status: 400 },
      );
    }

    // Enforce age-band modality gate. The story submission is mapped to
    // either the `text` modality (typed prompt) or the `voice` modality
    // (audio narration). Authed children resolve DoB from DB; guests pass
    // guestDob in the body. Guests without DoB fall back to `unknown` band.
    let dob: Date | null | undefined;
    if (session?.childId) {
      const child = await db.query.children.findFirst({
        where: eq(children.id, session.childId),
        columns: { dateOfBirth: true },
      });
      dob = child?.dateOfBirth;
    } else if (parsed.data.guestDob) {
      dob = new Date(parsed.data.guestDob);
    }
    const band = bandForDob(dob);
    const modality =
      parsed.data.submissionType === "audio" ? "voice" : "text";
    if (!isModalityAllowed(band, modality)) {
      return NextResponse.json(
        {
          error: "modality_not_allowed_for_age",
          message: "This input type is not available for this child's age.",
        },
        { status: 400 },
      );
    }

    // Moderate story text for child safety
    const moderationResult = await moderateContent({
      content: parsed.data.storyText,
      contentType: "text",
      sourceType: "discovery",
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

    // Run Claude story analysis
    const result = await analyzeStory(parsed.data);

    // If all talents have low confidence, add encouraging fallback
    const maxConfidence = Math.max(...result.talents.map((t) => t.confidence));
    if (maxConfidence < 0.5) {
      return NextResponse.json(
        {
          talents: result.talents,
          fallbackMessage: getUncertaintyFallback(),
          lowConfidence: true,
        },
        { status: 200 },
      );
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("Story analysis error:", error);

    // Check for timeout
    if (
      error instanceof Error &&
      error.message.includes("timed out")
    ) {
      return NextResponse.json(
        {
          error: "timeout",
          message:
            "The story analysis is taking too long. Please try again.",
        },
        { status: 504 },
      );
    }

    return NextResponse.json(
      {
        error: "ai_failure",
        message:
          "We couldn't analyze your story right now. Please try again!",
      },
      { status: 500 },
    );
  }
}
