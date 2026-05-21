import {
  createInterestAuditEvent,
  listInterestSignalsForChild,
  upsertChildInterestProfile,
} from "./repository";
import { type ScoringSignal, computeInterestScore, computeTrend } from "./scoring";
import {
  isInterestKey,
  isInterestSignalDimension,
  type InterestKey,
} from "./taxonomy";

type RawSignal = {
  interestKey: string;
  dimension: string;
  strength: number;
  confidence: number;
  observedAt: Date;
};

type ProfileDeps = {
  listSignals: typeof listInterestSignalsForChild;
  upsertProfile: typeof upsertChildInterestProfile;
  auditEvent: typeof createInterestAuditEvent;
};

function toScoringSignal(raw: RawSignal): ScoringSignal {
  return {
    strength: raw.strength,
    confidence: raw.confidence,
    dimension: raw.dimension as never,
    observedAt: raw.observedAt,
  };
}

function isValidSignal(raw: RawSignal): boolean {
  return isInterestKey(raw.interestKey) && isInterestSignalDimension(raw.dimension);
}

async function rebuildProfiles(
  childId: string,
  now: Date,
  deps: ProfileDeps,
): Promise<void> {
  const signals = (await deps.listSignals(childId)) as RawSignal[];

  let skippedSignalCount = 0;
  const grouped = new Map<InterestKey, RawSignal[]>();
  for (const signal of signals) {
    if (!isValidSignal(signal)) {
      skippedSignalCount++;
      continue;
    }
    const key = signal.interestKey as InterestKey;
    const existing = grouped.get(key) ?? [];
    existing.push(signal);
    grouped.set(key, existing);
  }

  for (const [interestKey, keySignals] of grouped) {
    const scoringSignals = keySignals.map(toScoringSignal);
    const score = computeInterestScore(scoringSignals, now);
    const trend = computeTrend(scoringSignals, now);
    const confidence =
      scoringSignals.reduce((acc, s) => acc + s.confidence, 0) / scoringSignals.length;
    const lastSignalAt = keySignals.reduce<Date | null>((latest, s) => {
      if (!latest || s.observedAt > latest) return s.observedAt;
      return latest;
    }, null);

    await deps.upsertProfile({
      childId,
      interestKey,
      score,
      confidence,
      signalCount: keySignals.length,
      lastSignalAt,
      trend,
    });
  }

  await deps.auditEvent({
    childId,
    eventType: "child_interest_profile_rebuilt",
    entityType: "child_interest_profile",
    metadataJson: { interestCount: grouped.size, skippedSignalCount },
  });
}

export async function rebuildChildInterestProfiles(
  childId: string,
  now = new Date(),
): Promise<void> {
  return rebuildProfiles(childId, now, {
    listSignals: listInterestSignalsForChild,
    upsertProfile: upsertChildInterestProfile,
    auditEvent: createInterestAuditEvent,
  });
}

export { rebuildProfiles as _rebuildChildInterestProfilesWithDeps };
