import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { Talent } from "@/lib/ai/schemas";

/**
 * GET /api/discovery/history
 *
 * Returns all discovery results for the authenticated child,
 * ordered by date descending (most recent first).
 * Supports pagination via `page` and `limit` query params.
 *
 * Response: { discoveries: [...], total, page, limit }
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.childId) {
      return NextResponse.json(
        { error: "unauthorized", message: "Authentication required" },
        { status: 401 },
      );
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10) || 20));
    const skip = (page - 1) * limit;

    const [discoveries, total] = await Promise.all([
      prisma.discovery.findMany({
        where: { childId: session.childId },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.discovery.count({
        where: { childId: session.childId },
      }),
    ]);

    const items = discoveries.map((d) => {
      let talents: Talent[] = [];
      try {
        talents = JSON.parse(d.detectedTalents ?? "[]");
      } catch {
        talents = [];
      }

      return {
        id: d.id,
        type: d.type,
        fileUrl: d.fileUrl,
        talents,
        createdAt: d.createdAt,
      };
    });

    return NextResponse.json(
      {
        discoveries: items,
        total,
        page,
        limit,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Discovery history error:", error);
    return NextResponse.json(
      { error: "server_error", message: "Failed to retrieve discovery history" },
      { status: 500 },
    );
  }
}
