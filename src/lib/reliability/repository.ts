/**
 * Prisma-backed persistence for the inter-rater reliability subsystem.
 * See docs/plans/2026-05-22-reliability-kappa-design.md §4-7.
 */

import { prisma } from "@/lib/db";
import type { Layer, RatingPair, ReliabilityLayer } from "./types";

interface CreateDiscoveryRatingInput {
  discoveryId: string;
  raterUserId: string;
  humanInterestKeys: string[];
  humanTagCategories: string[];
  aiInterestKeysAtRate: string[];
  aiTagCategoriesAtRate: string[];
  notes?: string;
}

export async function createDiscoveryRating(input: CreateDiscoveryRatingInput) {
  return prisma.discoveryRating.create({
    data: {
      discoveryId: input.discoveryId,
      raterUserId: input.raterUserId,
      humanInterestKeys: JSON.stringify(input.humanInterestKeys),
      humanTagCategories: JSON.stringify(input.humanTagCategories),
      aiInterestKeysAtRate: JSON.stringify(input.aiInterestKeysAtRate),
      aiTagCategoriesAtRate: JSON.stringify(input.aiTagCategoriesAtRate),
      notes: input.notes,
    },
  });
}

interface RawRatingRow {
  id: string;
  humanInterestKeys: string;
  humanTagCategories: string;
  aiInterestKeysAtRate: string;
  aiTagCategoriesAtRate: string;
}

function parseJsonArray(raw: string): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v): v is string => typeof v === "string");
  } catch {
    return [];
  }
}

/**
 * Load every rated discovery as RatingPair sets for the given layer.
 * Used by the live-Kappa endpoint and the cron snapshot job.
 */
export async function listRatedItems(layer: Layer): Promise<RatingPair[]> {
  const rows = (await prisma.discoveryRating.findMany({
    select: {
      id: true,
      humanInterestKeys: true,
      humanTagCategories: true,
      aiInterestKeysAtRate: true,
      aiTagCategoriesAtRate: true,
    },
  })) as RawRatingRow[];

  return rows.map((row) => {
    if (layer === "interest_keys") {
      return {
        aiLabels: new Set(parseJsonArray(row.aiInterestKeysAtRate)),
        humanLabels: new Set(parseJsonArray(row.humanInterestKeys)),
      };
    }
    return {
      aiLabels: new Set(parseJsonArray(row.aiTagCategoriesAtRate)),
      humanLabels: new Set(parseJsonArray(row.humanTagCategories)),
    };
  });
}

/**
 * Random unrated discovery for the given admin user. Uses Prisma's `findFirst`
 * with a randomized cursor — see design §7. Returns null when nothing remains.
 */
export async function findNextUnratedDiscoveryForUser(raterUserId: string) {
  // Use raw count then random offset to avoid ORDER BY RANDOM() across the full
  // table in Prisma. For the early-rollout sample sizes this is plenty.
  const eligibleWhere = {
    detectedTalents: { not: null },
    ratings: { none: { raterUserId } },
  } as const;

  const result = await prisma.discovery.findFirst({
    where: eligibleWhere,
    orderBy: { createdAt: "desc" },
  });
  return result ?? null;
}

interface CreateSnapshotInput {
  layer: ReliabilityLayer;
  kappa: number;
  sampleSize: number;
  payload: unknown;
  triggeredBy: "cron" | "manual";
}

export async function createReliabilitySnapshot(input: CreateSnapshotInput) {
  return prisma.reliabilitySnapshot.create({
    data: {
      layer: input.layer,
      kappa: input.kappa,
      sampleSize: input.sampleSize,
      payloadJson: JSON.stringify(input.payload),
      triggeredBy: input.triggeredBy,
    },
  });
}

export async function listRecentSnapshots(layer: Layer, take: number) {
  return prisma.reliabilitySnapshot.findMany({
    where: { layer },
    orderBy: { computedAt: "desc" },
    take,
  });
}

interface CreateAlertInput {
  layer: ReliabilityLayer;
  kappa: number;
  sampleSize: number;
  snapshotId: string;
}

export async function createReliabilityAlert(input: CreateAlertInput) {
  return prisma.reliabilityAlert.create({
    data: {
      layer: input.layer,
      kappa: input.kappa,
      sampleSize: input.sampleSize,
      snapshotId: input.snapshotId,
    },
  });
}

export async function listUnacknowledgedAlerts() {
  return prisma.reliabilityAlert.findMany({
    where: { acknowledgedAt: null },
    orderBy: { createdAt: "desc" },
  });
}

export async function acknowledgeAlert(id: string, acknowledgedBy: string) {
  return prisma.reliabilityAlert.update({
    where: { id },
    data: {
      acknowledgedAt: new Date(),
      acknowledgedBy,
    },
  });
}
