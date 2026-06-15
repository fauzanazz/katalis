/**
 * TanStack Start server functions for the admin reliability dashboard.
 * Mirrors: /api/admin/reliability/{alerts,alerts/[id]/ack,kappa,queue,ratings}
 * Cron routes (snapshot) are intentionally NOT ported here — they stay on Next:3100.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { db } from "@/lib/db";
import { interestSignals, discoveries, discoveryRatings } from "@/lib/schema";
import { eq, isNotNull, notInArray, and, count } from "drizzle-orm";
import { getAdminSession } from "@/lib/auth-start";
import { ok, err, type Result } from "@/lib/server/result";
import { computeLiveKappa, submitRating } from "@/lib/reliability/service";
import {
  listUnacknowledgedAlerts,
  acknowledgeAlert,
  findNextUnratedDiscoveryForUser,
} from "@/lib/reliability/repository";
import type { Layer } from "@/lib/reliability/types";
import { INTEREST_TAXONOMY_V1 } from "@/lib/interests/taxonomy";
import { TAG_CATEGORIES } from "@/lib/ai/tag-schemas";

// ─── Concrete output types ────────────────────────────────────────────────────

type PerLabelKappaOut = {
  label: string;
  kappa: number;
  support: number;
  confusion: {
    truePositive: number;
    falsePositive: number;
    falseNegative: number;
    trueNegative: number;
  };
};

type ConfusedPairOut = {
  aiLabel: string;
  humanLabel: string;
  count: number;
};

type AlertRow = {
  id: string;
  createdAt: string;
  layer: string;
  kappa: number;
  sampleSize: number;
  snapshotId: string | null;
  acknowledgedAt: string | null;
  acknowledgedBy: string | null;
};

// ─── computeLiveKappaFn ───────────────────────────────────────────────────────

const LayerSchema = z.object({
  layer: z.enum(["interest_keys", "tag_categories"]),
});

export const computeLiveKappaFn = createServerFn({ method: "GET" })
  .validator((d: unknown) => LayerSchema.parse(d))
  .handler(
    async ({
      data,
    }): Promise<
      Result<{
        layer: Layer;
        kappa: number | null;
        sampleSize: number;
        needed: number;
        perLabel: PerLabelKappaOut[];
        topConfused: ConfusedPairOut[];
        skipped: string[];
      }>
    > => {
      const admin = await getAdminSession();
      if (!admin) return err("unauthorized", "Admin access required");

      const result = await computeLiveKappa(data.layer);
      return ok({
        layer: result.layer,
        kappa: result.kappa,
        sampleSize: result.sampleSize,
        needed: result.needed,
        perLabel: result.perLabel.map((p) => ({
          label: p.label,
          kappa: p.kappa,
          support: p.support,
          confusion: {
            truePositive: p.confusion.truePositive,
            falsePositive: p.confusion.falsePositive,
            falseNegative: p.confusion.falseNegative,
            trueNegative: p.confusion.trueNegative,
          },
        })),
        topConfused: result.topConfused.map((c) => ({
          aiLabel: c.aiLabel,
          humanLabel: c.humanLabel,
          count: c.count,
        })),
        skipped: result.skipped,
      });
    },
  );

// ─── listReliabilityAlertsFn ──────────────────────────────────────────────────

export const listReliabilityAlertsFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<Result<{ alerts: AlertRow[] }>> => {
    const admin = await getAdminSession();
    if (!admin) return err("unauthorized", "Admin access required");

    const rows = await listUnacknowledgedAlerts();
    const alerts: AlertRow[] = rows.map((row) => ({
      id: row.id,
      createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
      layer: row.layer,
      kappa: row.kappa,
      sampleSize: row.sampleSize,
      snapshotId: row.snapshotId ?? null,
      acknowledgedAt:
        row.acknowledgedAt instanceof Date
          ? row.acknowledgedAt.toISOString()
          : row.acknowledgedAt
            ? String(row.acknowledgedAt)
            : null,
      acknowledgedBy: row.acknowledgedBy ?? null,
    }));

    return ok({ alerts });
  },
);

// ─── acknowledgeAlertFn ───────────────────────────────────────────────────────

const AcknowledgeSchema = z.object({ alertId: z.string().min(1) });

export const acknowledgeAlertFn = createServerFn({ method: "POST" })
  .validator((d: unknown) => AcknowledgeSchema.parse(d))
  .handler(
    async ({ data }): Promise<Result<{ acknowledged: true }>> => {
      const admin = await getAdminSession();
      if (!admin) return err("unauthorized", "Admin access required");

      try {
        await acknowledgeAlert(data.alertId, admin.userId);
        return ok({ acknowledged: true as const });
      } catch (error) {
        return err("ack_failed", (error as Error).message);
      }
    },
  );

// ─── getNextUnratedDiscoveryFn ────────────────────────────────────────────────

type DiscoveryOut = {
  id: string;
  childId: string;
  type: string;
  fileUrl: string | null;
  createdAt: string;
};

type NextUnratedOut = {
  discovery: DiscoveryOut | null;
  aiPredictions: { interestKeys: string[]; tagCategories: string[] };
  remaining: number;
  /** Taxonomy constants the rating form needs. */
  allInterestKeys: string[];
  allTagCategories: string[];
};

export const getNextUnratedDiscoveryFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<Result<NextUnratedOut>> => {
    const admin = await getAdminSession();
    if (!admin) return err("unauthorized", "Admin access required");

    const discovery = await findNextUnratedDiscoveryForUser(admin.userId);

    if (!discovery) {
      return ok({
        discovery: null,
        aiPredictions: { interestKeys: [], tagCategories: [] },
        remaining: 0,
        allInterestKeys: [...INTEREST_TAXONOMY_V1],
        allTagCategories: [...TAG_CATEGORIES],
      });
    }

    const signals = await db.query.interestSignals.findMany({
      where: eq(interestSignals.discoveryId, discovery.id),
      columns: { interestKey: true },
    });
    const aiInterestKeys = [...new Set(signals.map((s) => s.interestKey).filter(Boolean))] as string[];

    let aiTagCategories: string[] = [];
    if (discovery.detectedTalents) {
      try {
        const parsed = JSON.parse(discovery.detectedTalents);
        if (Array.isArray(parsed)) {
          const seen = new Set<string>();
          for (const entry of parsed) {
            if (entry && typeof entry === "object" && typeof entry.category === "string") {
              seen.add(entry.category);
            }
          }
          aiTagCategories = [...seen];
        }
      } catch {
        // ignore malformed JSON
      }
    }

    const ratedByUser = await db.query.discoveryRatings.findMany({
      where: eq(discoveryRatings.raterUserId, admin.userId),
      columns: { discoveryId: true },
    });
    const ratedIds = ratedByUser.map((r) => r.discoveryId);

    const remainingWhere =
      ratedIds.length > 0
        ? and(isNotNull(discoveries.detectedTalents), notInArray(discoveries.id, ratedIds))
        : isNotNull(discoveries.detectedTalents);

    const remainingRows = await db
      .select({ count: count() })
      .from(discoveries)
      .where(remainingWhere);

    const remaining = remainingRows[0].count;

    return ok({
      discovery: {
        id: discovery.id,
        childId: discovery.childId,
        type: discovery.type,
        fileUrl: discovery.fileUrl ?? null,
        createdAt:
          discovery.createdAt instanceof Date
            ? discovery.createdAt.toISOString()
            : String(discovery.createdAt),
      },
      aiPredictions: {
        interestKeys: aiInterestKeys,
        tagCategories: aiTagCategories,
      },
      remaining,
      allInterestKeys: [...INTEREST_TAXONOMY_V1],
      allTagCategories: [...TAG_CATEGORIES],
    });
  },
);

// ─── submitRatingFn ───────────────────────────────────────────────────────────

const SubmitRatingSchema = z.object({
  discoveryId: z.string().min(1),
  humanInterestKeys: z.array(z.enum(INTEREST_TAXONOMY_V1)).max(64),
  humanTagCategories: z.array(z.enum(TAG_CATEGORIES)).max(16),
  notes: z.string().max(2000).optional(),
});

export const submitRatingFn = createServerFn({ method: "POST" })
  .validator((d: unknown) => SubmitRatingSchema.parse(d))
  .handler(
    async ({ data }): Promise<Result<{ ratingId: string }>> => {
      const admin = await getAdminSession();
      if (!admin) return err("unauthorized", "Admin access required");

      try {
        const created = await submitRating({
          discoveryId: data.discoveryId,
          raterUserId: admin.userId,
          humanInterestKeys: data.humanInterestKeys,
          humanTagCategories: data.humanTagCategories,
          notes: data.notes,
        });
        return ok({ ratingId: created.id });
      } catch (error) {
        return err("submission_failed", (error as Error).message);
      }
    },
  );
