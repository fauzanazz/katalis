import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * GET /api/gallery/entries/[id]
 *
 * Returns a single gallery entry by ID. Publicly accessible (no auth required).
 * Strips childId from response for privacy.
 */
export async function GET(
  _request: NextRequest | Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const entry = await prisma.galleryEntry.findUnique({
      where: { id },
    });

    if (!entry) {
      return NextResponse.json(
        { error: "not_found", message: "Gallery entry not found" },
        { status: 404 },
      );
    }

    // Parse JSON fields and strip childId
    return NextResponse.json({
      id: entry.id,
      questId: entry.questId,
      imageUrl: entry.imageUrl,
      talentCategory: entry.talentCategory,
      country: entry.country,
      coordinates: safeParseJSON(entry.coordinates, null),
      questContext: safeParseJSON(entry.questContext, null),
      clusterGroup: entry.clusterGroup,
      createdAt: entry.createdAt,
    });
  } catch (error) {
    console.error("Gallery entry fetch error:", error);
    return NextResponse.json(
      { error: "server_error", message: "Failed to fetch gallery entry" },
      { status: 500 },
    );
  }
}

function safeParseJSON<T>(
  value: string | null | undefined,
  fallback: T,
): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
