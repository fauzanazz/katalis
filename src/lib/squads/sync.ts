/**
 * Squad sync service — persists AI-generated clusters as Squad records.
 * Creates/updates squads from clustering output, links children as members.
 */

import { db } from "@/lib/db";
import { galleryEntries, squads, squadMembers } from "@/lib/schema";
import { eq, isNotNull, count } from "drizzle-orm";
import { clusterGalleryEntries } from "@/lib/ai/client";
import type { ClusterEntry } from "@/lib/ai/clustering-schemas";

interface SyncResult {
  created: number;
  totalSquads: number;
}

export async function syncSquadsFromClusters(): Promise<SyncResult> {
  const entries = await db.query.galleryEntries.findMany({
    where: isNotNull(galleryEntries.coordinates),
    orderBy: (t, { desc }) => desc(t.createdAt),
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

  const result = await clusterGalleryEntries(clusterEntries);

  let created = 0;

  await db.transaction(async (tx) => {
    await tx
      .update(squads)
      .set({ status: "archived" })
      .where(eq(squads.status, "active"));

    for (const cluster of result.clusters) {
      const clusterEntriesInCluster = entries.filter((e) =>
        cluster.entryIds.includes(e.id),
      );

      const childIds = [...new Set(clusterEntriesInCluster.map((e) => e.childId))];

      const squad = (
        await tx
          .insert(squads)
          .values({
            name: cluster.label,
            theme: cluster.talentTheme,
            description: cluster.description,
            icon: getSquadIcon(cluster.talentTheme),
            countries: JSON.stringify(cluster.countries),
            featuredEntryIds: JSON.stringify(cluster.entryIds.slice(0, 6)),
            status: "active",
          })
          .returning()
      )[0];

      if (childIds.length > 0) {
        await tx
          .insert(squadMembers)
          .values(childIds.map((childId) => ({ squadId: squad.id, childId })));
      }

      created++;
    }
  });

  const [totalRow] = await db
    .select({ count: count() })
    .from(squads)
    .where(eq(squads.status, "active"));

  return { created, totalSquads: totalRow.count };
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
