import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

const GenerateCodesSchema = z.object({
  count: z.number().int().min(1).max(100).optional().default(1),
  prefix: z.string().min(1).max(20).optional().default("KATAL"),
  expiresInDays: z.number().int().min(1).max(365).optional().default(365),
});

function generateCode(prefix: string): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `${prefix}-${code}`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json(
        { error: "invalid", message: "Invalid request body" },
        { status: 400 },
      );
    }

    const parsed = GenerateCodesSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "invalid", message: "Invalid parameters", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { count, prefix, expiresInDays } = parsed.data;
    const expiresAt = new Date(
      Date.now() + expiresInDays * 24 * 60 * 60 * 1000,
    );

    const codes: Array<{ id: string; code: string; expiresAt: Date }> = [];

    for (let i = 0; i < count; i++) {
      // Generate unique code with retry
      let code: string;
      let attempts = 0;
      do {
        code = generateCode(prefix);
        attempts++;
        if (attempts > 10) {
          return NextResponse.json(
            {
              error: "internal",
              message: "Failed to generate unique code",
            },
            { status: 500 },
          );
        }
        const existing = await prisma.accessCode.findUnique({
          where: { code },
        });
        if (!existing) break;
      } while (true);

      const accessCode = await prisma.accessCode.create({
        data: {
          code,
          active: true,
          expiresAt,
        },
      });

      codes.push({
        id: accessCode.id,
        code: accessCode.code,
        expiresAt: accessCode.expiresAt!,
      });
    }

    return NextResponse.json({ codes }, { status: 201 });
  } catch (error) {
    console.error("Code generation error:", error);
    return NextResponse.json(
      { error: "internal", message: "An unexpected error occurred" },
      { status: 500 },
    );
  }
}
