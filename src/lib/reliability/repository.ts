/**
 * Drizzle-backed persistence for the inter-rater reliability subsystem.
 * See docs/plans/2026-05-22-reliability-kappa-design.md §4-7.
 */

import { db } from "@/lib/db";
import {
  discoveryRatings,
  discoveries,
  reliabilitySnapshots,
  reliabilityAlerts,
} from "@/lib/schema";
import { eq, isNull, isNotNull, desc } from "drizzle-orm";
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
  return (
    await db
      .insert(discoveryRatings)
      .values({
        discoveryId: input.discoveryId,
        raterUserId: input.raterUserId,
        humanInterestKeys: JSON.stringify(input.humanInterestKeys),
        humanTagCategories: JSON.stringify(input.humanTagCategories),
        aiInterestKeysAtRate: JSON.stringify(input.aiInterestKeysAtRate),
        aiTagCategoriesAtRate: JSON.stringify(input.aiTagCategoriesAtRate),
        notes: input.notes,
      })
      .returning()
  )[0];
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
  const rows = (await db.query.discoveryRatings.findMany({
    columns: {
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
 * Random unrated discovery for the given admin user. Uses a desc createdAt
 * cursor — see design §7. Returns null when nothing remains.
 */
export async function findNextUnratedDiscoveryForUser(raterUserId: string) {
  // Find a discovery with detectedTalents that has no rating from this user.
  // We fetch the first by createdAt desc; for early-rollout sample sizes this is adequate.
  const rated = await db.query.discoveryRatings.findMany({
    columns: { discoveryId: true },
    where: eq(discoveryRatings.raterUserId, raterUserId),
  });
  const ratedIds = rated.map((r) => r.discoveryId);

  const allEligible = await db.query.discoveries.findMany({
    where: isNotNull(discoveries.detectedTalents),
    orderBy: desc(discoveries.createdAt),
  });

  const result = allEligible.find((d) => !ratedIds.includes(d.id)) ?? null;
  return result;
}

interface CreateSnapshotInput {
  layer: ReliabilityLayer;
  kappa: number;
  sampleSize: number;
  payload: unknown;
  triggeredBy: "cron" | "manual";
}

export async function createReliabilitySnapshot(input: CreateSnapshotInput) {
  return (
    await db
      .insert(reliabilitySnapshots)
      .values({
        layer: input.layer,
        kappa: input.kappa,
        sampleSize: input.sampleSize,
        payloadJson: JSON.stringify(input.payload),
        triggeredBy: input.triggeredBy,
      })
      .returning()
  )[0];
}

export async function listRecentSnapshots(layer: Layer, take: number) {
  return db.query.reliabilitySnapshots.findMany({
    where: eq(reliabilitySnapshots.layer, layer),
    orderBy: desc(reliabilitySnapshots.computedAt),
    limit: take,
  });
}

interface CreateAlertInput {
  layer: ReliabilityLayer;
  kappa: number;
  sampleSize: number;
  snapshotId: string;
}

export async function createReliabilityAlert(input: CreateAlertInput) {
  return (
    await db
      .insert(reliabilityAlerts)
      .values({
        layer: input.layer,
        kappa: input.kappa,
        sampleSize: input.sampleSize,
        snapshotId: input.snapshotId,
      })
      .returning()
  )[0];
}

export async function listUnacknowledgedAlerts() {
  return db.query.reliabilityAlerts.findMany({
    where: isNull(reliabilityAlerts.acknowledgedAt),
    orderBy: desc(reliabilityAlerts.createdAt),
  });
}

export async function acknowledgeAlert(id: string, acknowledgedBy: string) {
  return (
    await db
      .update(reliabilityAlerts)
      .set({
        acknowledgedAt: new Date(),
        acknowledgedBy,
      })
      .where(eq(reliabilityAlerts.id, id))
      .returning()
  )[0];
}
