import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 200 });
  }

  let childName: string | null = null;
  if (session.type === "child" && session.childId) {
    const child = await prisma.child.findUnique({
      where: { id: session.childId },
      select: { name: true },
    });
    childName = child?.name ?? null;
  }

  return NextResponse.json({
    authenticated: true,
    type: session.type,
    childId: session.childId ?? null,
    hasUserId: !!session.userId,
    childName,
  });
}
