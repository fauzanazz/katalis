/**
 * Squad data access helpers.
 * Provides query functions for squad listing and detail views.
 */

import { prisma } from "@/lib/db";
import type { SquadSummary, SquadDetail } from "./schemas";

export async function getAllSquads(): Promise<SquadSummary[]> {
  const squads = await prisma.squad.findMany({
    where: { status: "active" },
    include: { _count: { select: { members: true } } },
    orderBy: { createdAt: "desc" },
  });

  return squads.map((squad) => ({
    id: squad.id,
    name: squad.name,
    theme: squad.theme,
    description: squad.description,
    icon: squad.icon,
    countries: JSON.parse(squad.countries) as string[],
    memberCount: squad._count.members,
    entryCount: (JSON.parse(squad.featuredEntryIds) as string[]).length,
    status: squad.status,
  }));
}

export async function getSquadById(squadId: string): Promise<SquadDetail | null> {
  const squad = await prisma.squad.findUnique({
    where: { id: squadId },
    include: {
      members: { select: { childId: true } },
    },
  });

  if (!squad || squad.status !== "active") return null;

  const featuredIds = JSON.parse(squad.featuredEntryIds) as string[];
  const entries = await prisma.galleryEntry.findMany({
    where: { id: { in: featuredIds } },
    orderBy: { createdAt: "desc" },
  });

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
  const memberships = await prisma.squadMember.findMany({
    where: { childId },
    include: {
      squad: {
        include: { _count: { select: { members: true } } },
      },
    },
  });

  return memberships.map((m) => {
    const squad = m.squad;
    return {
      id: squad.id,
      name: squad.name,
      theme: squad.theme,
      description: squad.description,
      icon: squad.icon,
      countries: JSON.parse(squad.countries) as string[],
      memberCount: squad._count.members,
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
  const squad = await prisma.squad.findUnique({
    where: { id: squadId },
  });

  if (!squad || squad.status !== "active") return { entries: [], total: 0 };

  const allEntryIds = JSON.parse(squad.featuredEntryIds) as string[];
  const skip = (page - 1) * pageSize;
  const pagedIds = allEntryIds.slice(skip, skip + pageSize);

  const entries = await prisma.galleryEntry.findMany({
    where: { id: { in: pagedIds } },
    orderBy: { createdAt: "desc" },
  });

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
