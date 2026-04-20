import { NextRequest, NextResponse } from "next/server";
import { getUserSession } from "@/lib/auth";
import { claimChild } from "@/lib/parent/link";
import { ClaimChildSchema } from "@/lib/parent/schemas";

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

    const parsed = ClaimChildSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "invalid",
          message: parsed.error.issues[0]?.message ?? "Invalid request",
        },
        { status: 400 },
      );
    }

    const result = await claimChild(session.userId, parsed.data.accessCode);

    if (!result.success) {
      return NextResponse.json(
        { error: "claim_failed", message: result.error },
        { status: 400 },
      );
    }

    return NextResponse.json({
      success: true,
      childId: result.childId,
    });
  } catch (error) {
    console.error("Parent claim error:", error);
    return NextResponse.json(
      { error: "server_error", message: "Failed to claim child" },
      { status: 500 },
    );
  }
}
