/**
 * Squad sync service — persists AI-generated clusters as Squad records.
 * Creates/updates squads from clustering output, links children as members.
 */

import { prisma } from "@/lib/db";
import { clusterGalleryEntries } from "@/lib/ai/claude";
import type { ClusterEntry } from "@/lib/ai/clustering-schemas";

interface SyncResult {
  created: number;
  updated: number;
  totalSquads: number;
}

export async function syncSquadsFromClusters(): Promise<SyncResult> {
  const entries = await prisma.galleryEntry.findMany({
    where: { coordinates: { not: null } },
    orderBy: { createdAt: "desc" },
  });

  if (entries.length === 0) {
    return { created: 0, updated: 0, totalSquads: 0 };
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

  const result = await clusterGalleryEntries(clusterEntries);

  await prisma.squad.updateMany({
    where: { status: "active" },
    data: { status: "archived" },
  });

  let created = 0;
  let updated = 0;

  for (const cluster of result.clusters) {
    const clusterEntries = entries.filter((e) =>
      cluster.entryIds.includes(e.id),
    );

    const childIds = [...new Set(clusterEntries.map((e) => e.childId))];

    const squad = await prisma.squad.create({
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

    for (const childId of childIds) {
      await prisma.squadMember.upsert({
        where: {
          squadId_childId: { squadId: squad.id, childId },
        },
        create: { squadId: squad.id, childId },
        update: {},
      });
    }

    created++;
  }

  const totalSquads = await prisma.squad.count({
    where: { status: "active" },
  });

  return { created, updated, totalSquads };
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
