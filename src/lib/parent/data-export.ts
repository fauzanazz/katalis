/**
 * Talent-journey data export.
 *
 * Parents can export the complete record of a child's journey through Katalis.
 * Beyond the raw rows, the export leads with a derived summary built to answer
 * the core product question: *is the app succeeding at sparking talent?*
 *
 * The metrics quantify that across five lenses:
 *   - Breadth   — how many distinct talents were surfaced.
 *   - Depth     — how strongly the top talents were detected (confidence).
 *   - Effort    — quests/missions completed, proof photos produced.
 *   - Engagement— mentor interactions and reflections.
 *   - Growth    — ZPD trajectory and interest stability over time.
 *
 * This module owns ONLY the pure summary derivation so it is unit-testable.
 * Gathering rows from the database lives in the calling server function.
 */

import { getAgeGroup, type AgeGroup } from "@/lib/age";

const MS_PER_DAY = 1000 * 60 * 60 * 24;

export interface ExportTalent {
  name: string;
  confidence: number;
}

export interface TalentJourneySummaryInput {
  child: { dateOfBirth: Date | null; createdAt: Date };
  discoveries: Array<{ type: string; detectedTalents: ExportTalent[] }>;
  quests: Array<{
    status: string;
    createdAt: Date;
    missions: Array<{ status: string; proofPhotoUrl: string | null }>;
  }>;
  galleryEntries: Array<{
    talentCategory: string;
    talentConfidence: number | null;
    questDurationDays: number | null;
    detectedTalents: ExportTalent[];
  }>;
  badges: Array<{ badgeSlug: string }>;
  reflectionCount: number;
  mentorSessionCount: number;
  mentorMessageCount: number;
  interestProfiles: Array<{
    interestKey: string;
    score: number;
    trend: string;
    stability: string;
  }>;
  gardnerProfiles: Array<{ intelligence: string; score: number }>;
  zpd: {
    current: { score: number; band: string } | null;
    snapshots: Array<{ score: number; createdAt: Date }>;
  };
  now?: Date;
}

export interface AggregatedTalent {
  name: string;
  occurrences: number;
  avgConfidence: number;
}

export interface TalentJourneySummary {
  generatedAt: string;
  accountAgeDays: number;
  ageBand: AgeGroup;
  ageYears: number | null;
  discoveries: { total: number; byType: Record<string, number> };
  quests: {
    started: number;
    completed: number;
    active: number;
    abandoned: number;
    completionRate: number;
  };
  missions: {
    total: number;
    completed: number;
    completionRate: number;
    proofPhotos: number;
  };
  talents: { distinctTalents: number; top: AggregatedTalent[] };
  gallery: {
    works: number;
    avgQuestDurationDays: number | null;
    talentCategories: Record<string, { count: number; avgConfidence: number | null }>;
  };
  engagement: {
    mentorSessions: number;
    mentorMessages: number;
    reflections: number;
    badges: number;
  };
  interests: {
    tracked: number;
    rising: number;
    enduring: number;
    top: Array<{ interestKey: string; score: number; trend: string; stability: string }>;
  };
  intelligences: Array<{ intelligence: string; score: number }>;
  growth: {
    currentScore: number | null;
    currentBand: string | null;
    firstScore: number | null;
    scoreDelta: number | null;
    snapshots: number;
  };
}

function round(value: number, places = 3): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

function aggregateTalents(talents: ExportTalent[]): AggregatedTalent[] {
  const byName = new Map<string, { sum: number; count: number }>();
  for (const talent of talents) {
    if (!talent?.name) continue;
    const acc = byName.get(talent.name) ?? { sum: 0, count: 0 };
    acc.sum += talent.confidence ?? 0;
    acc.count += 1;
    byName.set(talent.name, acc);
  }
  return Array.from(byName.entries())
    .map(([name, { sum, count }]) => ({
      name,
      occurrences: count,
      avgConfidence: round(sum / count),
    }))
    .sort(
      (a, b) =>
        b.occurrences - a.occurrences || b.avgConfidence - a.avgConfidence,
    );
}

function tally<T>(items: T[], key: (item: T) => string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const item of items) {
    const k = key(item);
    out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}

/**
 * Derive the talent-sparking success summary for a child's full journey.
 * Pure: no DB, no network; the only clock input is the injectable `now`.
 */
export function summarizeTalentJourney(
  input: TalentJourneySummaryInput,
): TalentJourneySummary {
  const now = input.now ?? new Date();

  const { band: ageBand, years: ageYears } = getAgeGroup(
    input.child.dateOfBirth,
    now,
  );

  // ── Quests + missions (effort / persistence) ──────────────────────────────
  const allMissions = input.quests.flatMap((q) => q.missions);
  const completedMissions = allMissions.filter((m) => m.status === "completed").length;
  const proofPhotos = allMissions.filter((m) => m.proofPhotoUrl).length;
  const completedQuests = input.quests.filter((q) => q.status === "completed").length;
  const abandonedQuests = input.quests.filter((q) => q.status === "abandoned").length;
  const activeQuests = input.quests.filter((q) => q.status === "active").length;

  // ── Talents (breadth + depth) ─────────────────────────────────────────────
  const allTalents = [
    ...input.discoveries.flatMap((d) => d.detectedTalents ?? []),
    ...input.galleryEntries.flatMap((g) => g.detectedTalents ?? []),
  ];
  const aggregatedTalents = aggregateTalents(allTalents);

  // ── Gallery (published works) ─────────────────────────────────────────────
  const durations = input.galleryEntries
    .map((g) => g.questDurationDays)
    .filter((d): d is number => d != null);
  const avgQuestDurationDays =
    durations.length > 0
      ? round(durations.reduce((sum, d) => sum + d, 0) / durations.length, 1)
      : null;

  const categoryAcc = new Map<string, { count: number; sum: number; withConfidence: number }>();
  for (const entry of input.galleryEntries) {
    const bucket = categoryAcc.get(entry.talentCategory) ?? {
      count: 0,
      sum: 0,
      withConfidence: 0,
    };
    bucket.count += 1;
    if (entry.talentConfidence != null) {
      bucket.sum += entry.talentConfidence;
      bucket.withConfidence += 1;
    }
    categoryAcc.set(entry.talentCategory, bucket);
  }
  const talentCategories: Record<string, { count: number; avgConfidence: number | null }> = {};
  for (const [category, bucket] of categoryAcc) {
    talentCategories[category] = {
      count: bucket.count,
      avgConfidence:
        bucket.withConfidence > 0 ? round(bucket.sum / bucket.withConfidence) : null,
    };
  }

  // ── Interests (stability over time) ───────────────────────────────────────
  const risingInterests = input.interestProfiles.filter((p) => p.trend === "rising").length;
  const enduringInterests = input.interestProfiles.filter(
    (p) => p.stability === "enduring",
  ).length;
  const topInterests = [...input.interestProfiles]
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((p) => ({
      interestKey: p.interestKey,
      score: round(p.score),
      trend: p.trend,
      stability: p.stability,
    }));

  const topIntelligences = [...input.gardnerProfiles]
    .sort((a, b) => b.score - a.score)
    .map((p) => ({ intelligence: p.intelligence, score: round(p.score) }));

  // ── Growth (ZPD trajectory) ───────────────────────────────────────────────
  const orderedSnapshots = [...input.zpd.snapshots].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
  );
  const firstScore = orderedSnapshots[0]?.score ?? null;
  const currentScore = input.zpd.current?.score ?? null;
  const scoreDelta =
    firstScore != null && currentScore != null ? round(currentScore - firstScore) : null;

  return {
    generatedAt: now.toISOString(),
    accountAgeDays: Math.max(
      0,
      Math.floor((now.getTime() - input.child.createdAt.getTime()) / MS_PER_DAY),
    ),
    ageBand,
    ageYears,
    discoveries: {
      total: input.discoveries.length,
      byType: tally(input.discoveries, (d) => d.type),
    },
    quests: {
      started: input.quests.length,
      completed: completedQuests,
      active: activeQuests,
      abandoned: abandonedQuests,
      completionRate:
        input.quests.length > 0 ? round(completedQuests / input.quests.length) : 0,
    },
    missions: {
      total: allMissions.length,
      completed: completedMissions,
      completionRate:
        allMissions.length > 0 ? round(completedMissions / allMissions.length) : 0,
      proofPhotos,
    },
    talents: {
      distinctTalents: aggregatedTalents.length,
      top: aggregatedTalents.slice(0, 10),
    },
    gallery: {
      works: input.galleryEntries.length,
      avgQuestDurationDays,
      talentCategories,
    },
    engagement: {
      mentorSessions: input.mentorSessionCount,
      mentorMessages: input.mentorMessageCount,
      reflections: input.reflectionCount,
      badges: input.badges.length,
    },
    interests: {
      tracked: input.interestProfiles.length,
      rising: risingInterests,
      enduring: enduringInterests,
      top: topInterests,
    },
    intelligences: topIntelligences,
    growth: {
      currentScore,
      currentBand: input.zpd.current?.band ?? null,
      firstScore,
      scoreDelta,
      snapshots: input.zpd.snapshots.length,
    },
  };
}
