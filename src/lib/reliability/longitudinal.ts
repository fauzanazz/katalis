/**
 * Longitudinal Validity for the interest detection pipeline.
 *
 * Spec ref: Katalis.docx §1.3c — "Track whether early interest signals
 * correlate with sustained engagement over weeks/months."
 *
 * Strategy:
 * 1. For each child, identify their top interestKey within the first
 *    EARLY_WINDOW_DAYS of signal activity.
 * 2. Measure their sustained engagement after that window via mission
 *    completion rate.
 * 3. Compute Pearson r across the cohort between (early top-interest
 *    score) and (sustained completion rate).
 *
 * Interpretation:
 * - r ≥ 0.3 → moderate positive validity (predictions track engagement)
 * - r ≥ 0.1 → weak positive validity
 * - r < 0.1 → no meaningful predictive validity yet
 */

import { prisma } from "@/lib/db";

export const EARLY_WINDOW_DAYS = 14;
export const SUSTAINED_WINDOW_DAYS = 60;
export const LONGITUDINAL_VALIDITY_THRESHOLD = 0.3;

export interface PerChildLongitudinal {
  childId: string;
  earlyTopInterest: string | null;
  earlyTopScore: number;
  sustainedCompletionRate: number;
  sampledMissionCount: number;
}

export interface LongitudinalSnapshot {
  layer: "longitudinal_validity";
  cohortSize: number;
  pearsonR: number | null;
  meanEarlyScore: number;
  meanCompletionRate: number;
  perChild: PerChildLongitudinal[];
}

const DAY = 24 * 60 * 60 * 1000;

export function pearsonCorrelation(x: readonly number[], y: readonly number[]): number | null {
  if (x.length !== y.length || x.length < 2) return null;
  const n = x.length;
  const meanX = x.reduce((a, b) => a + b, 0) / n;
  const meanY = y.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let denomX = 0;
  let denomY = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX;
    const dy = y[i] - meanY;
    num += dx * dy;
    denomX += dx * dx;
    denomY += dy * dy;
  }
  const denom = Math.sqrt(denomX * denomY);
  if (denom === 0) return null;
  return num / denom;
}

interface SignalRow {
  childId: string;
  interestKey: string;
  observedAt: Date;
  strength: number;
  confidence: number;
}

interface MissionRow {
  childId: string;
  status: string;
  createdAt: Date;
}

/**
 * Compute per-child early top interest + sustained completion rate.
 * Exported for unit-testing with synthetic inputs.
 */
export function computePerChild(
  signals: ReadonlyArray<SignalRow>,
  missions: ReadonlyArray<MissionRow>,
  now: Date,
  earlyWindowDays = EARLY_WINDOW_DAYS,
  sustainedWindowDays = SUSTAINED_WINDOW_DAYS,
): PerChildLongitudinal[] {
  const signalsByChild = new Map<string, SignalRow[]>();
  for (const s of signals) {
    const list = signalsByChild.get(s.childId) ?? [];
    list.push(s);
    signalsByChild.set(s.childId, list);
  }
  const missionsByChild = new Map<string, MissionRow[]>();
  for (const m of missions) {
    const list = missionsByChild.get(m.childId) ?? [];
    list.push(m);
    missionsByChild.set(m.childId, list);
  }

  const result: PerChildLongitudinal[] = [];

  for (const [childId, childSignals] of signalsByChild) {
    if (childSignals.length === 0) continue;

    const sorted = [...childSignals].sort(
      (a, b) => a.observedAt.getTime() - b.observedAt.getTime(),
    );
    const earliest = sorted[0].observedAt.getTime();
    const earlyCutoff = earliest + earlyWindowDays * DAY;
    const sustainedCutoff = earliest + sustainedWindowDays * DAY;

    const earlySignals = sorted.filter((s) => s.observedAt.getTime() <= earlyCutoff);
    const totals = new Map<string, number>();
    for (const s of earlySignals) {
      const v = totals.get(s.interestKey) ?? 0;
      totals.set(s.interestKey, v + s.strength * s.confidence);
    }

    let earlyTopInterest: string | null = null;
    let earlyTopScore = 0;
    for (const [key, score] of totals) {
      if (score > earlyTopScore) {
        earlyTopInterest = key;
        earlyTopScore = score;
      }
    }

    const childMissions = missionsByChild.get(childId) ?? [];
    const sustainedMissions = childMissions.filter((m) => {
      const t = m.createdAt.getTime();
      return t > earlyCutoff && t <= Math.min(sustainedCutoff, now.getTime());
    });

    const completionRate =
      sustainedMissions.length === 0
        ? 0
        : sustainedMissions.filter((m) => m.status === "completed").length /
          sustainedMissions.length;

    result.push({
      childId,
      earlyTopInterest,
      earlyTopScore,
      sustainedCompletionRate: completionRate,
      sampledMissionCount: sustainedMissions.length,
    });
  }

  return result;
}

export async function computeLongitudinalSnapshot(now = new Date()): Promise<LongitudinalSnapshot> {
  const signals = (await prisma.interestSignal.findMany({
    select: {
      childId: true,
      interestKey: true,
      observedAt: true,
      strength: true,
      confidence: true,
    },
  })) as SignalRow[];

  const missions = (await prisma.mission.findMany({
    select: {
      status: true,
      createdAt: true,
      quest: { select: { childId: true } },
    },
  })) as Array<{
    status: string;
    createdAt: Date;
    quest: { childId: string };
  }>;

  const missionRows: MissionRow[] = missions.map((m) => ({
    childId: m.quest.childId,
    status: m.status,
    createdAt: m.createdAt,
  }));

  const perChild = computePerChild(signals, missionRows, now);
  const sampled = perChild.filter((c) => c.sampledMissionCount > 0);

  if (sampled.length < 2) {
    return {
      layer: "longitudinal_validity",
      cohortSize: sampled.length,
      pearsonR: null,
      meanEarlyScore: 0,
      meanCompletionRate: 0,
      perChild,
    };
  }

  const xs = sampled.map((c) => c.earlyTopScore);
  const ys = sampled.map((c) => c.sustainedCompletionRate);
  const r = pearsonCorrelation(xs, ys);

  return {
    layer: "longitudinal_validity",
    cohortSize: sampled.length,
    pearsonR: r,
    meanEarlyScore: xs.reduce((a, b) => a + b, 0) / xs.length,
    meanCompletionRate: ys.reduce((a, b) => a + b, 0) / ys.length,
    perChild,
  };
}
