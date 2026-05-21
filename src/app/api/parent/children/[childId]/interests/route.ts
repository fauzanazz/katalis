import { NextRequest, NextResponse } from "next/server";
import { getUserSession } from "@/lib/auth";
import { verifyParentChildLink } from "@/lib/parent/link";
import { getParentInterestInsights } from "@/lib/interests/parent-insight-service";

/**
 * GET /api/parent/children/[childId]/interests
 *
 * Returns longitudinal interest insights for a child.
 * Requires authenticated parent with valid parent-child link.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ childId: string }> },
) {
  try {
    const session = await getUserSession();
    if (!session) {
      return NextResponse.json(
        { error: "unauthorized", message: "Authentication required" },
        { status: 401 },
      );
    }

    const { childId } = await params;

    const linked = await verifyParentChildLink(session.userId, childId);
    if (!linked) {
      return NextResponse.json(
        { error: "forbidden", message: "Access denied" },
        { status: 403 },
      );
    }

    const insights = await getParentInterestInsights(childId);

    return NextResponse.json(insights);
  } catch (error) {
    console.error("Parent interest insights error:", error);
    return NextResponse.json(
      { error: "server_error", message: "Failed to fetch interest insights" },
      { status: 500 },
    );
  }
}
