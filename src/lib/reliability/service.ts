/**
 * Orchestrates the reliability subsystem: rating submission, on-demand Kappa,
 * and the weekly snapshot job that drives alerts.
 * See docs/plans/2026-05-22-reliability-kappa-design.md §6-9.
 */

import { db } from "@/lib/db";
import { discoveries, interestSignals } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { INTEREST_TAXONOMY_V1 } from "@/lib/interests/taxonomy";
import { TAG_CATEGORIES } from "@/lib/ai/tag-schemas";
import { macroKappaMultiLabel } from "./kappa";
import {
  createDiscoveryRating,
  createReliabilityAlert,
  createReliabilitySnapshot,
  listRatedItems,
} from "./repository";
import {
  BIAS_MIN_SIGNALS,
  computeBiasSnapshot,
} from "./bias-monitor";
import {
  computeLongitudinalSnapshot,
  LONGITUDINAL_VALIDITY_THRESHOLD,
} from "./longitudinal";
import {
  computeTestRetestSnapshot,
  TEST_RETEST_MIN_PAIRS,
  TEST_RETEST_THRESHOLD,
} from "./test-retest";
import type { Layer, MacroKappaResult } from "./types";
import { LAYERS } from "./types";

export const MIN_SAMPLE_FOR_SURFACE = 50;
export const KAPPA_ADEQUACY_THRESHOLD = 0.6;

interface SubmitRatingInput {
  discoveryId: string;
  raterUserId: string;
  humanInterestKeys: string[];
  humanTagCategories: string[];
  notes?: string;
}

/**
 * Snapshot the AI labels live on the Discovery + InterestSignal rows, then persist
 * a DiscoveryRating row with human + AI labels frozen for Kappa stability.
 */
export async function submitRating(input: SubmitRatingInput) {
  const discovery = await db.query.discoveries.findFirst({
    where: eq(discoveries.id, input.discoveryId),
    columns: { id: true, detectedTalents: true },
  });
  if (!discovery) {
    throw new Error(`Discovery ${input.discoveryId} not found`);
  }

  const aiTagCategories = extractAiTagCategories(discovery.detectedTalents);
  const aiInterestKeys = await extractAiInterestKeys(input.discoveryId);

  return createDiscoveryRating({
    discoveryId: input.discoveryId,
    raterUserId: input.raterUserId,
    humanInterestKeys: input.humanInterestKeys,
    humanTagCategories: input.humanTagCategories,
    aiInterestKeysAtRate: aiInterestKeys,
    aiTagCategoriesAtRate: aiTagCategories,
    notes: input.notes,
  });
}

function extractAiTagCategories(detectedTalents: string | null): string[] {
  if (!detectedTalents) return [];
  try {
    const parsed = JSON.parse(detectedTalents);
    if (!Array.isArray(parsed)) return [];
    const seen = new Set<string>();
    for (const entry of parsed) {
      if (entry && typeof entry === "object" && typeof entry.category === "string") {
        seen.add(entry.category);
      }
    }
    return [...seen];
  } catch {
    return [];
  }
}

async function extractAiInterestKeys(discoveryId: string): Promise<string[]> {
  const signals = await db.query.interestSignals.findMany({
    where: eq(interestSignals.discoveryId, discoveryId),
    columns: { interestKey: true },
  });
  const seen = new Set<string>();
  for (const signal of signals) {
    if (typeof signal.interestKey === "string") {
      seen.add(signal.interestKey);
    }
  }
  return [...seen];
}

export interface LiveKappaResult {
  layer: Layer;
  kappa: number | null;
  sampleSize: number;
  /** Items still needed before Kappa is surfaced; 0 once threshold is reached. */
  needed: number;
  perLabel: MacroKappaResult["perLabel"];
  topConfused: MacroKappaResult["topConfused"];
  skipped: MacroKappaResult["skipped"];
}

const LAYER_DOMAINS: Record<Layer, readonly string[]> = {
  interest_keys: INTEREST_TAXONOMY_V1,
  tag_categories: TAG_CATEGORIES,
};

export async function computeLiveKappa(layer: Layer): Promise<LiveKappaResult> {
  const items = await listRatedItems(layer);
  const macro = macroKappaMultiLabel(LAYER_DOMAINS[layer], items);

  if (items.length < MIN_SAMPLE_FOR_SURFACE) {
    return {
      layer,
      kappa: null,
      sampleSize: items.length,
      needed: MIN_SAMPLE_FOR_SURFACE - items.length,
      perLabel: macro.perLabel,
      topConfused: macro.topConfused,
      skipped: macro.skipped,
    };
  }

  return {
    layer,
    kappa: macro.kappa,
    sampleSize: items.length,
    needed: 0,
    perLabel: macro.perLabel,
    topConfused: macro.topConfused,
    skipped: macro.skipped,
  };
}

export interface SnapshotJobResult {
  snapshotsCreated: number;
  alertsCreated: number;
}

/**
 * Runs one snapshot per Layer, persists ReliabilitySnapshot rows, and inserts a
 * ReliabilityAlert when (sample >= MIN) AND (kappa < threshold).
 *
 * Also runs test-retest reliability (§1.3a; threshold 0.7 Jaccard) and
 * longitudinal validity (§1.3c; threshold r=0.3 Pearson) and persists their
 * snapshots under distinct `layer` values.
 */
export async function runSnapshotJob(
  triggeredBy: "cron" | "manual",
): Promise<SnapshotJobResult> {
  let snapshotsCreated = 0;
  let alertsCreated = 0;

  for (const layer of LAYERS) {
    const live = await computeLiveKappa(layer);
    const kappaForSnapshot = live.kappa ?? 0;

    const snapshot = await createReliabilitySnapshot({
      layer,
      kappa: kappaForSnapshot,
      sampleSize: live.sampleSize,
      payload: {
        perLabel: live.perLabel,
        topConfused: live.topConfused,
        skipped: live.skipped,
        underMinSample: live.kappa === null,
      },
      triggeredBy,
    });
    snapshotsCreated += 1;

    if (
      live.sampleSize >= MIN_SAMPLE_FOR_SURFACE &&
      live.kappa !== null &&
      live.kappa < KAPPA_ADEQUACY_THRESHOLD
    ) {
      await createReliabilityAlert({
        layer,
        kappa: live.kappa,
        sampleSize: live.sampleSize,
        snapshotId: snapshot.id,
      });
      alertsCreated += 1;
    }
  }

  // Test-retest reliability snapshot.
  const testRetest = await computeTestRetestSnapshot();
  if (testRetest.cohortConsistency !== null) {
    const tr = await createReliabilitySnapshot({
      layer: "test_retest",
      kappa: testRetest.cohortConsistency,
      sampleSize: testRetest.pairCount,
      payload: {
        childCount: testRetest.childCount,
        childrenBelowThreshold: testRetest.childrenBelowThreshold,
        perChild: testRetest.perChild,
        threshold: TEST_RETEST_THRESHOLD,
      },
      triggeredBy,
    });
    snapshotsCreated += 1;

    if (
      testRetest.pairCount >= TEST_RETEST_MIN_PAIRS &&
      testRetest.cohortConsistency < TEST_RETEST_THRESHOLD
    ) {
      await createReliabilityAlert({
        layer: "test_retest",
        kappa: testRetest.cohortConsistency,
        sampleSize: testRetest.pairCount,
        snapshotId: tr.id,
      });
      alertsCreated += 1;
    }
  }

  // Bias monitor snapshot (§8.2). No alert is auto-raised — flagged
  // interests are surfaced for human review only.
  const bias = await computeBiasSnapshot();
  if (bias.sampleSize >= BIAS_MIN_SIGNALS) {
    await createReliabilitySnapshot({
      layer: "bias_monitor",
      kappa: bias.flaggedInterests.length === 0 ? 1 : 0,
      sampleSize: bias.sampleSize,
      payload: {
        perInterest: bias.perInterest,
        flaggedInterests: bias.flaggedInterests,
      },
      triggeredBy,
    });
    snapshotsCreated += 1;
  }

  // Longitudinal validity snapshot.
  const longitudinal = await computeLongitudinalSnapshot();
  if (longitudinal.pearsonR !== null) {
    const ls = await createReliabilitySnapshot({
      layer: "longitudinal_validity",
      kappa: longitudinal.pearsonR,
      sampleSize: longitudinal.cohortSize,
      payload: {
        meanEarlyScore: longitudinal.meanEarlyScore,
        meanCompletionRate: longitudinal.meanCompletionRate,
        perChild: longitudinal.perChild,
        threshold: LONGITUDINAL_VALIDITY_THRESHOLD,
      },
      triggeredBy,
    });
    snapshotsCreated += 1;

    if (longitudinal.pearsonR < LONGITUDINAL_VALIDITY_THRESHOLD) {
      await createReliabilityAlert({
        layer: "longitudinal_validity",
        kappa: longitudinal.pearsonR,
        sampleSize: longitudinal.cohortSize,
        snapshotId: ls.id,
      });
      alertsCreated += 1;
    }
  }

  return { snapshotsCreated, alertsCreated };
}
