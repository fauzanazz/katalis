import { NextResponse } from "next/server";
import { getAllSquads } from "@/lib/squads/queries";

/**
 * GET /api/squads
 *
 * Returns all active squads with member counts.
 * Publicly accessible (no auth required).
 */
export async function GET() {
  try {
    const squads = await getAllSquads();
    return NextResponse.json({ squads });
  } catch (error) {
    console.error("Squads fetch error:", error);
    return NextResponse.json(
      { error: "server_error", message: "Failed to fetch squads" },
      { status: 500 },
    );
  }
}
