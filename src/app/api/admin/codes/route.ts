import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getAdminSession } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { searchParams } = request.nextUrl;
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit")) || 20));
  const skip = (page - 1) * limit;

  const [codes, total] = await Promise.all([
    prisma.accessCode.findMany({
      select: {
        id: true,
        code: true,
        active: true,
        expiresAt: true,
        createdAt: true,
        _count: { select: { children: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.accessCode.count(),
  ]);

  return NextResponse.json({ codes, total, page, limit });
}

const CreateCodeSchema = z.object({
  code: z.string().min(1).max(50).optional(),
  expiresAt: z.string().datetime().optional(),
});

export async function POST(request: NextRequest) {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  const parsed = CreateCodeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation", details: parsed.error.issues }, { status: 400 });
  }

  const code = parsed.data.code ?? generateCode();

  if (parsed.data.code) {
    const existing = await prisma.accessCode.findUnique({ where: { code } });
    if (existing) {
      return NextResponse.json({ error: "code_exists" }, { status: 409 });
    }
  }

  const accessCode = await prisma.accessCode.create({
    data: {
      code,
      active: true,
      expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
    },
    select: { id: true, code: true, active: true, expiresAt: true, createdAt: true },
  });

  return NextResponse.json(accessCode, { status: 201 });
}

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const segments = Array.from({ length: 3 }, () =>
    Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join(""),
  );
  return segments.join("-");
}
