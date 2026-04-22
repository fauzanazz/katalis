import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getUserSession, createChildSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

const SwitchChildSchema = z.object({
  childId: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const session = await getUserSession();
    if (!session) {
      return NextResponse.json(
        { error: "unauthorized", message: "Authentication required" },
        { status: 401 },
      );
    }

    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json(
        { error: "invalid", message: "Invalid request body" },
        { status: 400 },
      );
    }

    const parsed = SwitchChildSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "invalid",
          message: parsed.error.issues[0]?.message ?? "Invalid request",
        },
        { status: 400 },
      );
    }

    const { childId } = parsed.data;

    const link = await prisma.parentChild.findFirst({
      where: { userId: session.userId, childId },
    });

    if (!link) {
      return NextResponse.json(
        { error: "forbidden", message: "No parent-child link found" },
        { status: 403 },
      );
    }

    await createChildSession(childId);

    return NextResponse.json({ success: true, childId });
  } catch (error) {
    console.error("Parent switch-child error:", error);
    return NextResponse.json(
      { error: "server_error", message: "Failed to switch child session" },
      { status: 500 },
    );
  }
}
