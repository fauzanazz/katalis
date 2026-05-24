import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { moderationEvents } from "@/lib/schema";
import { eq } from "drizzle-orm";

/**
 * PATCH /api/admin/moderation/[id]
 *
 * Review a moderation event. Admin-only.
 */

const ReviewSchema = z.object({
  action: z.enum(["approve", "block"], {
    message: "Action must be 'approve' or 'block'",
  }),
  notes: z.string().max(1000).optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json(
      { error: "unauthorized", message: "Admin access required" },
      { status: 401 },
    );
  }

  try {
    const { id } = await params;
    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json(
        { error: "invalid", message: "Invalid request body" },
        { status: 400 },
      );
    }

    const parsed = ReviewSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "invalid",
          message: parsed.error.issues[0]?.message ?? "Invalid request",
        },
        { status: 400 },
      );
    }

    const { action, notes } = parsed.data;

    const event = await db.query.moderationEvents.findFirst({
      where: eq(moderationEvents.id, id),
    });
    if (!event) {
      return NextResponse.json(
        { error: "not_found", message: "Moderation event not found" },
        { status: 404 },
      );
    }

    const newStatus = action === "approve" ? "approved" : "blocked";

    const updated = (
      await db
        .update(moderationEvents)
        .set({
          status: newStatus,
          reviewerId: admin.userId,
          reviewedAt: new Date(),
          metadata: notes
            ? JSON.stringify({
                ...safeParseJSON(event.metadata),
                reviewNotes: notes,
              })
            : event.metadata,
        })
        .where(eq(moderationEvents.id, id))
        .returning()
    )[0];

    return NextResponse.json({ success: true, event: updated });
  } catch (error) {
    console.error("Moderation review error:", error);
    return NextResponse.json(
      { error: "server_error", message: "Failed to review moderation event" },
      { status: 500 },
    );
  }
}

function safeParseJSON(value: string | null): Record<string, unknown> {
  if (!value) return {};
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return {};
  }
}
