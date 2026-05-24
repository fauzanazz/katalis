import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getChildSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { children } from "@/lib/schema";
import { sanitizeInput } from "@/lib/sanitize";
import { isAllowedStorageUrl } from "@/lib/url-allowlist";
import { AnalysisInputSchema } from "@/lib/ai/schemas";
import { analyzeArtifact } from "@/lib/ai/client";
import { moderateImageContent, getUncertaintyFallback } from "@/lib/moderation";
import {
  bandForDob,
  isModalityAllowed,
  modalityFromArtifactType,
} from "@/lib/discover/age-modality";
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
 * POST /api/discovery/analyze
 *
 * Accepts an artifact URL and type, runs GPT-4o multimodal analysis,
 * and returns detected talents with detailed reasoning.
 *
 * Request body: { artifactUrl: string, artifactType: "image" | "audio" }
 * Response:     { talents: Array<{ name, confidence, reasoning }> }
 */
export async function POST(request: NextRequest) {
  try {
    // Auth is optional — guests can analyze if they provide a guestDob.
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

    // Sanitize the artifact URL unconditionally to prevent XSS
    if (body.artifactUrl && typeof body.artifactUrl === "string") {
      body.artifactUrl = sanitizeInput(body.artifactUrl);

      // Validate URL origin against allowlist (defense-in-depth)
      if (!isAllowedStorageUrl(body.artifactUrl)) {
        return NextResponse.json(
          { error: "invalid", message: "Invalid artifact URL" },
          { status: 400 },
        );
      }
    }

    // Validate input with Zod
    const parsed = AnalysisInputSchema.safeParse(body);
    if (!parsed.success) {
      const message =
        parsed.error.issues[0]?.message ?? "Invalid request";
      return NextResponse.json(
        { error: "invalid", message },
        { status: 400 },
      );
    }

    // Enforce age-band modality gate (defense in depth alongside the UI).
    // Authed children resolve DoB from DB; guests must pass guestDob in body.
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
    const modality = modalityFromArtifactType(parsed.data.artifactType);
    if (!isModalityAllowed(band, modality)) {
      return NextResponse.json(
        {
          error: "modality_not_allowed_for_age",
          message: "This input type is not available for this child's age.",
        },
        { status: 400 },
      );
    }

    // Moderate image content for child safety
    const moderationResult = await moderateImageContent({
      imageUrl: parsed.data.artifactUrl,
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
        { status: 403 },
      );
    }

    // Run AI analysis
    const result = await analyzeArtifact(parsed.data);

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
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[Analysis] Error:", errorMessage, error);

    // Check for timeout
    if (errorMessage.includes("timed out")) {
      return NextResponse.json(
        {
          error: "timeout",
          message:
            "The analysis is taking too long. Please try again.",
        },
        { status: 504 },
      );
    }

    return NextResponse.json(
      {
        error: "ai_failure",
        message:
          "We couldn't analyze your creation right now. Please try again!",
      },
      { status: 500 },
    );
  }
}
