import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { clusterGalleryEntries } from "@/lib/ai/client";
import type { ClusterEntry } from "@/lib/ai/clustering-schemas";

/**
 * POST /api/gallery/cluster
 *
 * Generates AI-powered clusters from gallery entries.
 * Groups entries by talent category and geographic proximity.
 * Returns meaningful, child-friendly cluster labels.
 *
 * Publicly accessible (no auth required) — read-only clustering
 * of existing gallery data.
 */
export async function POST() {
  try {
    // Fetch all gallery entries with coordinates
    const entries = await prisma.galleryEntry.findMany({
      where: {
        coordinates: { not: null },
      },
      orderBy: { createdAt: "desc" },
    });

    if (entries.length === 0) {
      return NextResponse.json({
        clusters: [],
        totalEntries: 0,
      });
    }

    // Map DB entries to clustering input format
    const clusterEntries: ClusterEntry[] = entries.map((entry) => {
      let coords: { lat: number; lng: number } | null = null;
      if (entry.coordinates) {
        try {
          coords = JSON.parse(entry.coordinates) as { lat: number; lng: number };
        } catch {
          coords = null;
        }
      }

      return {
        id: entry.id,
        talentCategory: entry.talentCategory,
        country: entry.country,
        coordinates: coords,
      };
    });

    // Call Claude AI for clustering
    const result = await clusterGalleryEntries(clusterEntries);

    // Enrich clusters with entry data
    const entryMap = new Map(entries.map((e) => [e.id, e]));
    const enrichedClusters = result.clusters.map((cluster) => ({
      ...cluster,
      entries: cluster.entryIds
        .map((id) => {
          const entry = entryMap.get(id);
          if (!entry) return null;

          let questContext = null;
          if (entry.questContext) {
            try {
              questContext = JSON.parse(entry.questContext);
            } catch {
              questContext = null;
            }
          }

          return {
            id: entry.id,
            imageUrl: entry.imageUrl,
            talentCategory: entry.talentCategory,
            country: entry.country,
            questContext,
            createdAt: entry.createdAt,
          };
        })
        .filter(Boolean),
    }));

    return NextResponse.json({
      clusters: enrichedClusters,
      totalEntries: entries.length,
    });
  } catch (error) {
    console.error("Gallery clustering error:", error);
    return NextResponse.json(
      { error: "clustering_failed", message: "Failed to generate gallery clusters" },
      { status: 500 },
    );
  }
}
