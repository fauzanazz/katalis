import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import { syncSquadsFromClusters } from "@/lib/squads/sync";

/**
 * POST /api/squads/sync
 *
 * Triggers AI clustering → squad sync. Admin-only.
 * Creates/updates Squad records from AI-generated clusters.
 */
export async function POST() {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json(
        { error: "unauthorized", message: "Admin access required" },
        { status: 401 },
      );
    }

    const result = await syncSquadsFromClusters();

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("Squad sync error:", error);
    return NextResponse.json(
      { error: "sync_failed", message: "Failed to sync squads" },
      { status: 500 },
    );
  }
}
