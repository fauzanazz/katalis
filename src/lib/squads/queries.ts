/**
 * Squad data access helpers.
 * Provides query functions for squad listing and detail views.
 */

import { db } from "@/lib/db";
import { squads, squadMembers, galleryEntries } from "@/lib/schema";
import { eq, inArray, count, desc } from "drizzle-orm";
import type { SquadSummary, SquadDetail } from "./schemas";

async function getMemberCountMap(squadIds: string[]): Promise<Map<string, number>> {
  if (squadIds.length === 0) return new Map();
  const rows = await db
    .select({ squadId: squadMembers.squadId, count: count() })
    .from(squadMembers)
    .where(inArray(squadMembers.squadId, squadIds))
    .groupBy(squadMembers.squadId);
  return new Map(rows.map((r) => [r.squadId, r.count]));
}

export async function getAllSquads(): Promise<SquadSummary[]> {
  const rows = await db.query.squads.findMany({
    where: eq(squads.status, "active"),
    orderBy: desc(squads.createdAt),
  });

  const countMap = await getMemberCountMap(rows.map((s) => s.id));

  return rows.map((squad) => ({
    id: squad.id,
    name: squad.name,
    theme: squad.theme,
    description: squad.description,
    icon: squad.icon,
    countries: JSON.parse(squad.countries) as string[],
    memberCount: countMap.get(squad.id) ?? 0,
    entryCount: (JSON.parse(squad.featuredEntryIds) as string[]).length,
    status: squad.status,
  }));
}

export async function getSquadById(squadId: string): Promise<SquadDetail | null> {
  const squad = await db.query.squads.findFirst({
    where: eq(squads.id, squadId),
    with: { members: { columns: { childId: true } } },
  });

  if (squad == null || squad.status !== "active") return null;

  const featuredIds = JSON.parse(squad.featuredEntryIds) as string[];
  const entries = featuredIds.length > 0
    ? await db.query.galleryEntries.findMany({
        where: inArray(galleryEntries.id, featuredIds),
        orderBy: desc(galleryEntries.createdAt),
      })
    : [];

  return {
    id: squad.id,
    name: squad.name,
    theme: squad.theme,
    description: squad.description,
    icon: squad.icon,
    countries: JSON.parse(squad.countries) as string[],
    memberCount: squad.members.length,
    entryCount: featuredIds.length,
    status: squad.status,
    featuredEntries: entries.map((e) => ({
      id: e.id,
      imageUrl: e.imageUrl,
      talentCategory: e.talentCategory,
      country: e.country,
    })),
    entries: entries.map((e) => ({
      id: e.id,
      imageUrl: e.imageUrl,
      talentCategory: e.talentCategory,
      country: e.country,
      questContext: e.questContext ? JSON.parse(e.questContext) : null,
      createdAt: e.createdAt.toISOString(),
    })),
  };
}

export async function getChildSquads(childId: string): Promise<SquadSummary[]> {
  const memberships = await db.query.squadMembers.findMany({
    where: eq(squadMembers.childId, childId),
    with: { squad: true },
  });

  const squadIds = memberships.map((m) => m.squad.id);
  const countMap = await getMemberCountMap(squadIds);

  return memberships.map((m) => {
    const squad = m.squad;
    return {
      id: squad.id,
      name: squad.name,
      theme: squad.theme,
      description: squad.description,
      icon: squad.icon,
      countries: JSON.parse(squad.countries) as string[],
      memberCount: countMap.get(squad.id) ?? 0,
      entryCount: (JSON.parse(squad.featuredEntryIds) as string[]).length,
      status: squad.status,
    };
  });
}

export async function getSquadEntries(
  squadId: string,
  page = 1,
  pageSize = 20,
) {
  const squad = await db.query.squads.findFirst({
    where: eq(squads.id, squadId),
  });

  if (squad == null || squad.status !== "active") return { entries: [], total: 0 };

  const allEntryIds = JSON.parse(squad.featuredEntryIds) as string[];
  const skip = (page - 1) * pageSize;
  const pagedIds = allEntryIds.slice(skip, skip + pageSize);

  const entries = pagedIds.length > 0
    ? await db.query.galleryEntries.findMany({
        where: inArray(galleryEntries.id, pagedIds),
        orderBy: desc(galleryEntries.createdAt),
      })
    : [];

  return {
    entries: entries.map((e) => ({
      id: e.id,
      imageUrl: e.imageUrl,
      talentCategory: e.talentCategory,
      talentTags: e.talentTags ? JSON.parse(e.talentTags) : null,
      country: e.country,
      questContext: e.questContext ? JSON.parse(e.questContext) : null,
      createdAt: e.createdAt.toISOString(),
    })),
    total: allEntryIds.length,
  };
}
