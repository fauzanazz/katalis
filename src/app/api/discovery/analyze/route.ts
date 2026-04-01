import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { sanitizeInput, containsSuspiciousPatterns } from "@/lib/sanitize";
import { AnalysisInputSchema } from "@/lib/ai/schemas";
import { analyzeArtifact } from "@/lib/ai/openai";

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

    // Sanitize the artifact URL to prevent XSS
    if (body.artifactUrl && typeof body.artifactUrl === "string") {
      const sanitized = sanitizeInput(body.artifactUrl);
      if (containsSuspiciousPatterns(body.artifactUrl)) {
        return NextResponse.json(
          { error: "invalid", message: "Invalid artifact URL" },
          { status: 400 },
        );
      }
      body.artifactUrl = sanitized;
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

    // Run AI analysis
    const result = await analyzeArtifact(parsed.data);

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
