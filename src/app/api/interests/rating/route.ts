import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getUserSession, getChildSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { missions } from "@/lib/schema";
import { verifyParentChildLink } from "@/lib/parent/link";
import { isInterestKey } from "@/lib/interests/taxonomy";
import { submitMissionInterestRating } from "@/lib/interests/explicit-rating-service";

const RatingSchema = z.object({
  childId: z.string().min(1),
  missionId: z.string().min(1),
  interestKey: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  rater: z.enum(["child", "parent"]),
  notes: z.string().optional(),
});

/**
 * POST /api/interests/rating
 *
 * Submit an explicit interest rating for a mission.
 * Parent rater: requires parent-child link verification.
 * Both raters: mission must belong to the child via quest relation.
 *
 * Request: { childId, missionId, interestKey, rating, rater, notes? }
 * Response: { ok: true }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json(
        { error: "invalid", message: "Invalid request body" },
        { status: 400 },
      );
    }

    const parsed = RatingSchema.safeParse(body);
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? "Invalid request";
      return NextResponse.json(
        { error: "invalid", message },
        { status: 400 },
      );
    }

    const { childId, missionId, interestKey, rating, rater, notes } = parsed.data;

    if (!isInterestKey(interestKey)) {
      return NextResponse.json(
        { error: "invalid", message: `Unknown interest key: ${interestKey}` },
        { status: 400 },
      );
    }

    if (rater === "parent") {
      const parentSession = await getUserSession();
      if (!parentSession) {
        return NextResponse.json(
          { error: "unauthorized", message: "Authentication required" },
          { status: 401 },
        );
      }
      const linked = await verifyParentChildLink(parentSession.userId, childId);
      if (!linked) {
        return NextResponse.json(
          { error: "forbidden", message: "Access denied" },
          { status: 403 },
        );
      }
    } else {
      // rater === "child"
      const childSession = await getChildSession();
      if (!childSession) {
        return NextResponse.json(
          { error: "unauthorized", message: "Authentication required" },
          { status: 401 },
        );
      }
      if (childSession.childId !== childId) {
        return NextResponse.json(
          { error: "forbidden", message: "Access denied" },
          { status: 403 },
        );
      }
    }

    // Verify mission belongs to this child via quest relation
    const mission = await db.query.missions.findFirst({
      where: eq(missions.id, missionId),
      with: {
        quest: { columns: { childId: true } },
      },
      columns: { id: true },
    });
    if (!mission || mission.quest.childId !== childId) {
      return NextResponse.json(
        { error: "forbidden", message: "Access denied" },
        { status: 403 },
      );
    }

    await submitMissionInterestRating({
      childId,
      missionId,
      interestKey,
      rating,
      rater,
      notes,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Interest rating error:", error);
    return NextResponse.json(
      { error: "server_error", message: "Failed to submit rating" },
      { status: 500 },
    );
  }
}
