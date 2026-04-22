import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getUserSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { routing } from "@/i18n/routing";

const CreateChildSchema = z.object({
  name: z.string().min(1).max(50),
  locale: z.enum([...routing.locales]).optional(),
});

export async function POST(request: NextRequest | Request) {
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

    const parsed = CreateChildSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "invalid",
          message: parsed.error.issues[0]?.message ?? "Invalid request",
        },
        { status: 400 },
      );
    }

    const { name, locale = routing.defaultLocale } = parsed.data;

    const child = await prisma.$transaction(async (tx) => {
      const newChild = await tx.child.create({
        data: { name, locale },
        select: { id: true, name: true, locale: true, createdAt: true },
      });

      await tx.parentChild.create({
        data: { userId: session.userId, childId: newChild.id },
      });

      return newChild;
    });

    return NextResponse.json({ success: true, child });
  } catch (error) {
    console.error("Parent create-child error:", error);
    return NextResponse.json(
      { error: "server_error", message: "Failed to create child" },
      { status: 500 },
    );
  }
}
