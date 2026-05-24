import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { accessCodes, children } from "@/lib/schema";
import { eq, desc, count } from "drizzle-orm";
import { getAdminSession } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { searchParams } = request.nextUrl;
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit")) || 20));
  const offset = (page - 1) * limit;

  const [codes, totalRows] = await Promise.all([
    db
      .select({
        id: accessCodes.id,
        code: accessCodes.code,
        active: accessCodes.active,
        expiresAt: accessCodes.expiresAt,
        createdAt: accessCodes.createdAt,
        childCount: count(children.id),
      })
      .from(accessCodes)
      .leftJoin(children, eq(children.accessCodeId, accessCodes.id))
      .groupBy(accessCodes.id)
      .orderBy(desc(accessCodes.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ count: count() }).from(accessCodes),
  ]);

  const total = totalRows[0].count;

  return NextResponse.json({
    codes: codes.map((c) => ({
      id: c.id,
      code: c.code,
      active: c.active,
      expiresAt: c.expiresAt,
      createdAt: c.createdAt,
      _count: { children: c.childCount },
    })),
    total,
    page,
    limit,
  });
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
    const existing = await db.query.accessCodes.findFirst({
      where: eq(accessCodes.code, code),
    });
    if (existing) {
      return NextResponse.json({ error: "code_exists" }, { status: 409 });
    }
  }

  const accessCode = (
    await db
      .insert(accessCodes)
      .values({
        code,
        active: true,
        expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
      })
      .returning({
        id: accessCodes.id,
        code: accessCodes.code,
        active: accessCodes.active,
        expiresAt: accessCodes.expiresAt,
        createdAt: accessCodes.createdAt,
      })
  )[0];

  return NextResponse.json(accessCode, { status: 201 });
}

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const segments = Array.from({ length: 3 }, () =>
    Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join(""),
  );
  return segments.join("-");
}
