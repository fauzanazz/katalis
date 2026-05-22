import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getUserSession } from "@/lib/auth";
import { verifyParentChildLink } from "@/lib/parent/link";
import { getParentInterestInsights } from "@/lib/interests/parent-insight-service";
import {
  overrideInterestProfile,
  resetChildInterests,
} from "@/lib/interests/parent-override-service";
import { INTEREST_TAXONOMY_V1 } from "@/lib/interests/taxonomy";

/**
 * GET /api/parent/children/[childId]/interests
 *
 * Returns longitudinal interest insights for a child.
 * Requires authenticated parent with valid parent-child link.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ childId: string }> },
) {
  try {
    const session = await getUserSession();
    if (!session) {
      return NextResponse.json(
        { error: "unauthorized", message: "Authentication required" },
        { status: 401 },
      );
    }

    const { childId } = await params;

    const linked = await verifyParentChildLink(session.userId, childId);
    if (!linked) {
      return NextResponse.json(
        { error: "forbidden", message: "Access denied" },
        { status: 403 },
      );
    }

    const insights = await getParentInterestInsights(childId);

    return NextResponse.json(insights);
  } catch (error) {
    console.error("Parent interest insights error:", error);
    return NextResponse.json(
      { error: "server_error", message: "Failed to fetch interest insights" },
      { status: 500 },
    );
  }
}

const OverrideBodySchema = z.object({
  interestKey: z.enum(INTEREST_TAXONOMY_V1),
  score: z.number().min(0).max(1),
  confidence: z.number().min(0).max(1).optional(),
  reason: z.string().max(500).optional(),
});

/**
 * PATCH /api/parent/children/[childId]/interests
 *
 * Parent override of a single interest profile entry. Spec ref §8.3b.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ childId: string }> },
) {
  try {
    const session = await getUserSession();
    if (!session) {
      return NextResponse.json(
        { error: "unauthorized", message: "Authentication required" },
        { status: 401 },
      );
    }

    const { childId } = await params;
    const linked = await verifyParentChildLink(session.userId, childId);
    if (!linked) {
      return NextResponse.json(
        { error: "forbidden", message: "Access denied" },
        { status: 403 },
      );
    }

    const body = await request.json().catch(() => null);
    const parsed = OverrideBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "invalid", message: parsed.error.issues[0]?.message ?? "Invalid request" },
        { status: 400 },
      );
    }

    await overrideInterestProfile({
      childId,
      parentUserId: session.userId,
      interestKey: parsed.data.interestKey,
      score: parsed.data.score,
      confidence: parsed.data.confidence,
      reason: parsed.data.reason,
    });

    const insights = await getParentInterestInsights(childId);
    return NextResponse.json(insights);
  } catch (error) {
    console.error("Parent interest override error:", error);
    return NextResponse.json(
      { error: "server_error", message: "Failed to override interest" },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/parent/children/[childId]/interests
 *
 * Reset all interest signals + profiles for the child. Spec ref §8.3b
 * ("parents can reset interest labels") and §8.3c ("parents can request
 * deletion at any time").
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ childId: string }> },
) {
  try {
    const session = await getUserSession();
    if (!session) {
      return NextResponse.json(
        { error: "unauthorized", message: "Authentication required" },
        { status: 401 },
      );
    }

    const { childId } = await params;
    const linked = await verifyParentChildLink(session.userId, childId);
    if (!linked) {
      return NextResponse.json(
        { error: "forbidden", message: "Access denied" },
        { status: 403 },
      );
    }

    let reason: string | undefined;
    try {
      const body = (await request.json()) as { reason?: string };
      if (typeof body?.reason === "string") reason = body.reason.slice(0, 500);
    } catch {
      // Body is optional.
    }

    const summary = await resetChildInterests({
      childId,
      parentUserId: session.userId,
      reason,
    });

    return NextResponse.json({ ok: true, deleted: summary });
  } catch (error) {
    console.error("Parent interest reset error:", error);
    return NextResponse.json(
      { error: "server_error", message: "Failed to reset interest data" },
      { status: 500 },
    );
  }
}
