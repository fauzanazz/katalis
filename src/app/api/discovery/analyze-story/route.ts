import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { sanitizeInput } from "@/lib/sanitize";
import { StoryAnalysisInputSchema } from "@/lib/ai/story-schemas";
import { analyzeStory } from "@/lib/ai/claude";

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

    // Run Claude story analysis
    const result = await analyzeStory(parsed.data);

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
