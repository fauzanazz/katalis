import { NextRequest, NextResponse } from "next/server";
import { eq, isNotNull, and, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { galleryEntries } from "@/lib/schema";

/**
 * GET /api/gallery/entries/geojson
 *
 * Returns gallery entries as GeoJSON FeatureCollection for map rendering.
 * Publicly accessible (no auth required).
 * Only includes entries with valid coordinates.
 *
 * Query params:
 * - talentCategory (optional filter)
 */
export async function GET(request: NextRequest | Request) {
  try {
    const url = new URL(request.url);
    const talentCategory = url.searchParams.get("talentCategory");

    const whereCondition = talentCategory
      ? and(isNotNull(galleryEntries.coordinates), eq(galleryEntries.talentCategory, talentCategory))
      : isNotNull(galleryEntries.coordinates);

    const entries = await db.query.galleryEntries.findMany({
      where: whereCondition,
      orderBy: desc(galleryEntries.createdAt),
    });

    // Convert to GeoJSON FeatureCollection
    const features = entries
      .map((entry) => {
        const coords = safeParseJSON<{ lat: number; lng: number } | null>(
          entry.coordinates,
          null,
        );
        if (!coords || typeof coords.lat !== "number" || typeof coords.lng !== "number") {
          return null;
        }

        const questContext = safeParseJSON<{
          questTitle?: string;
          dream?: string;
          missionSummaries?: string[];
        } | null>(entry.questContext, null);

        return {
          type: "Feature" as const,
          geometry: {
            type: "Point" as const,
            coordinates: [coords.lng, coords.lat], // GeoJSON uses [lng, lat]
          },
          properties: {
            id: entry.id,
            imageUrl: entry.imageUrl,
            talentCategory: entry.talentCategory,
            country: entry.country ?? "",
            questContext: questContext,
            createdAt: entry.createdAt.toISOString(),
          },
        };
      })
      .filter(Boolean);

    return NextResponse.json({
      type: "FeatureCollection",
      features,
    });
  } catch (error) {
    console.error("Gallery GeoJSON fetch error:", error);
    return NextResponse.json(
      { error: "server_error", message: "Failed to fetch gallery entries" },
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
