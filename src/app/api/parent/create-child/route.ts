import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getUserSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { routing } from "@/i18n/routing";

function generateAccessCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let suffix = "";
  for (let i = 0; i < 6; i++) suffix += chars.charAt(Math.floor(Math.random() * chars.length));
  return `KATAL-${suffix}`;
}

const CreateChildSchema = z.object({
  name: z.string().min(1).max(50),
  locale: z.enum([...routing.locales]).optional(),
  /** ISO date string. Required for new Child rows; legacy rows backfill later. */
  dateOfBirth: z
    .string()
    .datetime({ message: "dateOfBirth must be an ISO datetime string" })
    .optional(),
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

    const { name, locale = routing.defaultLocale, dateOfBirth } = parsed.data;
    const dob = dateOfBirth ? new Date(dateOfBirth) : null;

    if (dob) {
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
    }

    const { child, accessCode } = await prisma.$transaction(async (tx) => {
      // Generate unique access code
      let code: string;
      let attempts = 0;
      do {
        code = generateAccessCode();
        if (++attempts > 10) throw new Error("Failed to generate unique access code");
        const existing = await tx.accessCode.findUnique({ where: { code } });
        if (!existing) break;
      } while (true);

      const newAccessCode = await tx.accessCode.create({
        data: { code, active: true, expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) },
      });

      const newChild = await tx.child.create({
        data: { name, locale, dateOfBirth: dob, accessCodeId: newAccessCode.id },
        select: { id: true, name: true, locale: true, dateOfBirth: true, createdAt: true },
      });

      await tx.parentChild.create({
        data: { userId: session.userId, childId: newChild.id },
      });

      return { child: newChild, accessCode: newAccessCode.code };
    });

    return NextResponse.json({ success: true, child, accessCode });
  } catch (error) {
    console.error("Parent create-child error:", error);
    return NextResponse.json(
      { error: "server_error", message: "Failed to create child" },
      { status: 500 },
    );
  }
}
