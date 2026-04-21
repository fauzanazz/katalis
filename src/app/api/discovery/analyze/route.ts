import { NextRequest, NextResponse } from "next/server";
import { getChildSession } from "@/lib/auth";
import { sanitizeInput } from "@/lib/sanitize";
import { isAllowedStorageUrl } from "@/lib/url-allowlist";
import { AnalysisInputSchema } from "@/lib/ai/schemas";
import { analyzeArtifact } from "@/lib/ai/client";
import { moderateImageContent, getUncertaintyFallback } from "@/lib/moderation";

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
    // Require authentication
    const session = await getChildSession();
    if (!session) {
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

    // Moderate image content for child safety
    const moderationResult = await moderateImageContent({
      imageUrl: parsed.data.artifactUrl,
      sourceType: "discovery",
      childId: session.childId,
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
    console.error("Analysis error:", error);

    // Check for timeout
    if (
      error instanceof Error &&
      error.message.includes("timed out")
    ) {
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
