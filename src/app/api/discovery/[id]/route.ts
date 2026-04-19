import { NextRequest, NextResponse } from "next/server";
import { getChildSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { Talent } from "@/lib/ai/schemas";

/**
 * GET /api/discovery/[id]
 *
 * Returns a single discovery result by ID.
 * Only accessible by the child who owns the discovery.
 *
 * Response: { id, type, fileUrl, talents, createdAt }
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getChildSession();
    if (!session) {
      return NextResponse.json(
        { error: "unauthorized", message: "Authentication required" },
        { status: 401 },
      );
    }

    const { id } = await params;

    const discovery = await prisma.discovery.findUnique({
      where: { id },
    });

    if (!discovery) {
      return NextResponse.json(
        { error: "not_found", message: "Discovery not found" },
        { status: 404 },
      );
    }

    // Only allow the owning child to view
    if (discovery.childId !== session.childId) {
      return NextResponse.json(
        { error: "forbidden", message: "Access denied" },
        { status: 403 },
      );
    }

    let talents: Talent[] = [];
    try {
      talents = JSON.parse(discovery.detectedTalents ?? "[]");
    } catch {
      talents = [];
    }

    return NextResponse.json(
      {
        id: discovery.id,
        type: discovery.type,
        fileUrl: discovery.fileUrl,
        talents,
        createdAt: discovery.createdAt,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Get discovery error:", error);
    return NextResponse.json(
      { error: "server_error", message: "Failed to retrieve discovery" },
      { status: 500 },
    );
  }
}
