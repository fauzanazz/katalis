import { randomInt } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getUserSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { accessCodes, children, parentChildren } from "@/lib/schema";
import { routing } from "@/i18n/routing";
import { getAgeGroup } from "@/lib/age";

function generateAccessCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let suffix = "";
  for (let i = 0; i < 6; i++) suffix += chars.charAt(randomInt(chars.length));
  return `KATAL-${suffix}`;
}

const CreateChildSchema = z.object({
  name: z.string().min(1).max(50),
  locale: z.enum([...routing.locales]).optional(),
  dateOfBirth: z
    .string()
    .datetime({ message: "dateOfBirth must be an ISO datetime string" }),
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
    const dob = new Date(dateOfBirth);

    const { years } = getAgeGroup(dob);
    if (years === null || years < 3 || years > 12) {
      return NextResponse.json(
        {
          error: "invalid",
          message: "dateOfBirth must indicate an age between 3 and 12 years.",
        },
        { status: 400 },
      );
    }

    const { child, accessCode } = await db.transaction(async (tx) => {
      // Generate unique access code
      let code: string;
      let attempts = 0;
      do {
        code = generateAccessCode();
        if (++attempts > 10) throw new Error("Failed to generate unique access code");
        const existing = await tx.query.accessCodes.findFirst({
          where: eq(accessCodes.code, code),
        });
        if (!existing) break;
      } while (true);

      const newAccessCode = (
        await tx
          .insert(accessCodes)
          .values({
            code: code!,
            active: true,
            expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          })
          .returning()
      )[0];

      const newChild = (
        await tx
          .insert(children)
          .values({ name, locale, dateOfBirth: dob, accessCodeId: newAccessCode.id })
          .returning({
            id: children.id,
            name: children.name,
            locale: children.locale,
            dateOfBirth: children.dateOfBirth,
            createdAt: children.createdAt,
          })
      )[0];

      await tx.insert(parentChildren).values({
        userId: session.userId,
        childId: newChild.id,
        consentGivenAt: new Date(),
        consentTextVersion: "v1",
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
