import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { children } from "@/lib/schema";

export async function GET() {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 200 });
  }

  let childName: string | null = null;
  if (session.type === "child" && session.childId) {
    try {
      const child = await db.query.children.findFirst({
        where: eq(children.id, session.childId),
        columns: { name: true },
      });
      childName = child?.name ?? null;
    } catch (error) {
      console.error("Session child lookup failed:", error);
    }
  }

  return NextResponse.json({
    authenticated: true,
    type: session.type,
    childId: session.childId ?? null,
    hasUserId: !!session.userId,
    childName,
  });
}
