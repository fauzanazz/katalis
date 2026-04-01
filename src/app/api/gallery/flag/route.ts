import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sanitizeInput } from "@/lib/sanitize";

/**
 * POST /api/gallery/flag
 *
 * Basic content safety flag mechanism for gallery entries.
 * Logs flagged content for review (in production, this would
 * integrate with a moderation queue).
 *
 * Publicly accessible — anyone can flag inappropriate content.
 */

const FlagSchema = z.object({
  entryId: z.string().min(1, "Entry ID is required"),
  reason: z.enum(["inappropriate", "offensive", "spam", "other"], {
    message: "Invalid flag reason",
  }),
  details: z.string().max(500).optional(),
});

export async function POST(request: NextRequest | Request) {
  try {
    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json(
        { error: "invalid", message: "Invalid request body" },
        { status: 400 },
      );
    }

    const parsed = FlagSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "invalid",
          message: parsed.error.issues[0]?.message ?? "Invalid request",
        },
        { status: 400 },
      );
    }

    const { entryId, reason, details } = parsed.data;

    // Sanitize any user-provided text
    const sanitizedDetails = details ? sanitizeInput(details) : undefined;

    // Log the flag (in production, this would persist to a moderation queue)
    console.log(
      `[CONTENT FLAG] Entry: ${entryId}, Reason: ${reason}, Details: ${sanitizedDetails ?? "none"}`,
    );

    return NextResponse.json({
      success: true,
      message: "Thank you for reporting. Our team will review this content.",
    });
  } catch (error) {
    console.error("Content flag error:", error);
    return NextResponse.json(
      { error: "server_error", message: "Failed to submit report" },
      { status: 500 },
    );
  }
}
