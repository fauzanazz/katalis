import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sanitizeInput } from "@/lib/sanitize";
import { prisma } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";

/**
 * POST /api/gallery/flag
 *
 * Content safety flag mechanism for gallery entries.
 * Persists flags to the ModerationEvent table for admin review.
 */

const FlagSchema = z.object({
  entryId: z.string().min(1, "Entry ID is required"),
  reason: z.enum(["inappropriate", "offensive", "spam", "other"], {
    message: "Invalid flag reason",
  }),
  details: z.string().max(500).optional(),
});

const REASON_TO_CATEGORY: Record<string, string> = {
  inappropriate: "sexual",
  offensive: "hate",
  spam: "spam",
  other: "other",
};

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

    // Rate limit flag submissions
    const ip = request.headers.get("x-forwarded-for") ?? "unknown";
    const { limited } = await checkRateLimit(`flag:${ip}`, "flag");
    if (limited) {
      return NextResponse.json(
        { error: "rate_limited", message: "Too many reports. Please try again later." },
        { status: 429 },
      );
    }

    const sanitizedDetails = details ? sanitizeInput(details) : undefined;

    await prisma.moderationEvent.create({
      data: {
        sourceType: "flag",
        sourceId: entryId,
        contentType: "image",
        status: "flagged",
        category: REASON_TO_CATEGORY[reason] ?? "other",
        severity: reason === "inappropriate" ? "high" : "medium",
        metadata: JSON.stringify({
          reason,
          details: sanitizedDetails,
        }),
      },
    });

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
