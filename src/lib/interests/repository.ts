import { prisma } from "@/lib/db";
import {
  INTEREST_TAXONOMY_VERSION,
  type InterestKey,
  type InterestSignalDimension,
  type InterestSignalSource,
  assertInterestKey,
} from "./taxonomy";

export type CreateInterestSignalInput = {
  childId: string;
  interestKey: InterestKey;
  source: InterestSignalSource;
  dimension: InterestSignalDimension;
  strength: number;
  confidence?: number;
  discoveryId?: string;
  questId?: string;
  missionId?: string;
  reflectionEntryId?: string;
  galleryEntryId?: string;
  metadataJson?: unknown;
  observedAt?: Date;
};

export type UpsertChildInterestProfileInput = {
  childId: string;
  interestKey: InterestKey;
  score: number;
  confidence: number;
  signalCount: number;
  lastSignalAt?: Date | null;
  trend?: string;
  summary?: string | null;
};

export type CreateInterestAuditEventInput = {
  childId?: string;
  actorUserId?: string;
  eventType: string;
  entityType: string;
  entityId?: string;
  beforeJson?: unknown;
  afterJson?: unknown;
  metadataJson?: unknown;
};

export type UpsertMissionInterestAssessmentInput = {
  childId: string;
  missionId: string;
  interestKey: InterestKey;
  explicitRating?: number | null;
  parentRating?: number | null;
  childRating?: number | null;
  observedEngagement?: number | null;
  notes?: string | null;
};

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function serializeJson(value: unknown, fieldName: string): string | undefined {
  if (value === undefined || value === null) return undefined;
  try {
    return JSON.stringify(value);
  } catch {
    throw new Error(`${fieldName} is not JSON-serializable`);
  }
}

type RatingField = "explicitRating" | "parentRating" | "childRating" | "observedEngagement";

function validateRating(value: number | null | undefined, field: RatingField): void {
  if (value === undefined || value === null) return;
  if (!Number.isInteger(value) || value < 1 || value > 5) {
    throw new Error(`${field} must be an integer between 1 and 5`);
  }
}

export async function createInterestSignal(input: CreateInterestSignalInput) {
  assertInterestKey(input.interestKey);

  return prisma.interestSignal.create({
    data: {
      childId: input.childId,
      taxonomyVersion: INTEREST_TAXONOMY_VERSION,
      interestKey: input.interestKey,
      source: input.source,
      dimension: input.dimension,
      strength: clamp(input.strength, -1, 1),
      confidence: clamp(input.confidence ?? 1, 0, 1),
      discoveryId: input.discoveryId,
      questId: input.questId,
      missionId: input.missionId,
      reflectionEntryId: input.reflectionEntryId,
      galleryEntryId: input.galleryEntryId,
      metadataJson: serializeJson(input.metadataJson, "metadataJson"),
      observedAt: input.observedAt,
    },
  });
}

export async function listInterestSignalsForChild(childId: string) {
  return prisma.interestSignal.findMany({
    where: { childId },
    orderBy: { observedAt: "desc" },
  });
}

export async function upsertChildInterestProfile(input: UpsertChildInterestProfileInput) {
  assertInterestKey(input.interestKey);

  const data = {
    score: clamp(input.score, 0, 1),
    confidence: clamp(input.confidence, 0, 1),
    signalCount: input.signalCount,
    lastSignalAt: input.lastSignalAt,
    trend: input.trend ?? "stable",
    summary: input.summary,
  };

  return prisma.childInterestProfile.upsert({
    where: {
      childId_taxonomyVersion_interestKey: {
        childId: input.childId,
        taxonomyVersion: INTEREST_TAXONOMY_VERSION,
        interestKey: input.interestKey,
      },
    },
    create: {
      childId: input.childId,
      taxonomyVersion: INTEREST_TAXONOMY_VERSION,
      interestKey: input.interestKey,
      ...data,
    },
    update: data,
  });
}

export async function createInterestAuditEvent(input: CreateInterestAuditEventInput) {
  return prisma.interestAuditEvent.create({
    data: {
      childId: input.childId,
      actorUserId: input.actorUserId,
      eventType: input.eventType,
      entityType: input.entityType,
      entityId: input.entityId,
      beforeJson: serializeJson(input.beforeJson, "beforeJson"),
      afterJson: serializeJson(input.afterJson, "afterJson"),
      metadataJson: serializeJson(input.metadataJson, "metadataJson"),
    },
  });
}

export async function upsertMissionInterestAssessment(input: UpsertMissionInterestAssessmentInput) {
  assertInterestKey(input.interestKey);

  validateRating(input.explicitRating, "explicitRating");
  validateRating(input.parentRating, "parentRating");
  validateRating(input.childRating, "childRating");
  validateRating(input.observedEngagement, "observedEngagement");

  const data = {
    explicitRating: input.explicitRating,
    parentRating: input.parentRating,
    childRating: input.childRating,
    observedEngagement: input.observedEngagement,
    notes: input.notes,
  };

  return prisma.missionInterestAssessment.upsert({
    where: {
      childId_missionId_interestKey: {
        childId: input.childId,
        missionId: input.missionId,
        interestKey: input.interestKey,
      },
    },
    create: {
      childId: input.childId,
      missionId: input.missionId,
      taxonomyVersion: INTEREST_TAXONOMY_VERSION,
      interestKey: input.interestKey,
      ...data,
    },
    update: data,
  });
}
