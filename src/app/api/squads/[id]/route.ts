import { NextRequest, NextResponse } from "next/server";
import { getSquadById, getSquadEntries } from "@/lib/squads/queries";

/**
 * GET /api/squads/[id]
 *
 * Returns squad detail with paginated entries.
 * Query params: page (default 1), pageSize (default 20).
 * Publicly accessible (no auth required).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const url = new URL(request.url);
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10) || 1);
    const pageSize = Math.min(50, Math.max(1, parseInt(url.searchParams.get("pageSize") || "20", 10) || 20));

    const squad = await getSquadById(id);
    if (!squad) {
      return NextResponse.json(
        { error: "not_found", message: "Squad not found" },
        { status: 404 },
      );
    }

    const { entries, total } = await getSquadEntries(id, page, pageSize);

    return NextResponse.json({
      squad,
      entries,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    console.error("Squad detail fetch error:", error);
    return NextResponse.json(
      { error: "server_error", message: "Failed to fetch squad" },
      { status: 500 },
    );
  }
}
