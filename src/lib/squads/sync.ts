/**
 * Squad sync service — persists AI-generated clusters as Squad records.
 * Creates/updates squads from clustering output, links children as members.
 */

import { prisma } from "@/lib/db";
import { clusterGalleryEntries } from "@/lib/ai/claude";
import type { ClusterEntry } from "@/lib/ai/clustering-schemas";

interface SyncResult {
  created: number;
  totalSquads: number;
}

export async function syncSquadsFromClusters(): Promise<SyncResult> {
  const entries = await prisma.galleryEntry.findMany({
    where: { coordinates: { not: null } },
    orderBy: { createdAt: "desc" },
  });

  if (entries.length === 0) {
    return { created: 0, totalSquads: 0 };
  }

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

  // Get AI clusters
  const result = await clusterGalleryEntries(clusterEntries);

  let created = 0;

  await prisma.$transaction(async (tx) => {
    // Archive existing squads within transaction
    await tx.squad.updateMany({
      where: { status: "active" },
      data: { status: "archived" },
    });

    for (const cluster of result.clusters) {
      const clusterEntriesInCluster = entries.filter((e) =>
        cluster.entryIds.includes(e.id),
      );

      const childIds = [...new Set(clusterEntriesInCluster.map((e) => e.childId))];

      const squad = await tx.squad.create({
        data: {
          name: cluster.label,
          theme: cluster.talentTheme,
          description: cluster.description,
          icon: getSquadIcon(cluster.talentTheme),
          countries: JSON.stringify(cluster.countries),
          featuredEntryIds: JSON.stringify(cluster.entryIds.slice(0, 6)),
          status: "active",
        },
      });

      // Batch create squad members
      if (childIds.length > 0) {
        await tx.squadMember.createMany({
          data: childIds.map((childId) => ({ squadId: squad.id, childId })),
        });
      }

      created++;
    }
  });

  const totalSquads = await prisma.squad.count({
    where: { status: "active" },
  });

  return { created, totalSquads };
}

function getSquadIcon(theme: string): string {
  const icons: Record<string, string> = {
    Engineering: "🤖",
    Art: "🎨",
    Narrative: "📖",
    Music: "🎵",
    Science: "🔬",
    Creative: "✨",
    Leadership: "🏆",
    Empathy: "💚",
  };
  return icons[theme] ?? "🌟";
}
