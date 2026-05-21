import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getUserSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { verifyParentChildLink } from "@/lib/parent/link";

const UpdateChildSchema = z.object({
  dateOfBirth: z
    .string()
    .datetime({ message: "dateOfBirth must be an ISO datetime string" })
    .optional(),
});

/**
 * PATCH /api/parent/children/[childId]
 *
 * Updates Child fields for a child linked to the authenticated parent. Used
 * primarily to backfill `dateOfBirth` for legacy rows.
 */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ childId: string }> },
) {
  try {
    const session = await getUserSession();
    if (!session) {
      return NextResponse.json(
        { error: "unauthorized", message: "Authentication required" },
        { status: 401 },
      );
    }

    const { childId } = await context.params;
    const linked = await verifyParentChildLink(session.userId, childId);
    if (!linked) {
      return NextResponse.json(
        { error: "forbidden", message: "Access denied" },
        { status: 403 },
      );
    }

    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json(
        { error: "invalid", message: "Invalid request body" },
        { status: 400 },
      );
    }

    const parsed = UpdateChildSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "invalid",
          message: parsed.error.issues[0]?.message ?? "Invalid request",
        },
        { status: 400 },
      );
    }

    if (!parsed.data.dateOfBirth) {
      return NextResponse.json(
        { error: "invalid", message: "No updatable fields supplied." },
        { status: 400 },
      );
    }

    const dob = new Date(parsed.data.dateOfBirth);
    const years = (Date.now() - dob.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
    if (years < 3 || years >= 13) {
      return NextResponse.json(
        {
          error: "invalid",
          message: "dateOfBirth must indicate an age between 3 and 12 years.",
        },
        { status: 400 },
      );
    }

    const updated = await prisma.child.update({
      where: { id: childId },
      data: { dateOfBirth: dob },
      select: { id: true, name: true, locale: true, dateOfBirth: true },
    });

    return NextResponse.json({ child: updated });
  } catch (error) {
    console.error("Parent update-child error:", error);
    return NextResponse.json(
      { error: "server_error", message: "Failed to update child" },
      { status: 500 },
    );
  }
}
