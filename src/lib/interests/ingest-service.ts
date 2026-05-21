import { createInterestAuditEvent, createInterestSignal } from "./repository";
import { rebuildChildInterestProfiles } from "./profile-service";
import type { InterestKey, InterestSignalDimension, InterestSignalSource } from "./taxonomy";

export type IngestInterestSignalsInput = {
  childId: string;
  source: InterestSignalSource;
  signals: Array<{
    interestKey: InterestKey;
    dimension: InterestSignalDimension;
    strength: number;
    confidence?: number;
    metadataJson?: unknown;
  }>;
  discoveryId?: string;
  questId?: string;
  missionId?: string;
  reflectionEntryId?: string;
  galleryEntryId?: string;
  observedAt?: Date;
};

type IngestDeps = {
  createSignal: typeof createInterestSignal;
  auditEvent: typeof createInterestAuditEvent;
  rebuildProfiles: typeof rebuildChildInterestProfiles;
};

async function ingest(
  input: IngestInterestSignalsInput,
  deps: IngestDeps,
): Promise<{ created: number }> {
  if (input.signals.length === 0) return { created: 0 };

  const now = input.observedAt ?? new Date();

  for (const signal of input.signals) {
    await deps.createSignal({
      childId: input.childId,
      source: input.source,
      interestKey: signal.interestKey,
      dimension: signal.dimension,
      strength: signal.strength,
      confidence: signal.confidence,
      metadataJson: signal.metadataJson,
      discoveryId: input.discoveryId,
      questId: input.questId,
      missionId: input.missionId,
      reflectionEntryId: input.reflectionEntryId,
      galleryEntryId: input.galleryEntryId,
      observedAt: now,
    });
  }

  await deps.auditEvent({
    childId: input.childId,
    eventType: "interest_signals_ingested",
    entityType: "interest_signal",
    metadataJson: { source: input.source, count: input.signals.length },
  });

  await deps.rebuildProfiles(input.childId, now);

  return { created: input.signals.length };
}

export async function ingestInterestSignals(
  input: IngestInterestSignalsInput,
): Promise<{ created: number }> {
  return ingest(input, {
    createSignal: createInterestSignal,
    auditEvent: createInterestAuditEvent,
    rebuildProfiles: rebuildChildInterestProfiles,
  });
}

export { ingest as _ingestInterestSignalsWithDeps };
