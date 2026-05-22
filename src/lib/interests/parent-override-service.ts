/**
 * Parent-driven overrides for a child's interest profile.
 *
 * Spec ref: Katalis.docx §8.3b — "Provide an option for parents to disagree
 * with or reset interest labels."
 *
 * Two operations are supported:
 * 1. `overrideInterestProfile` — set a single profile row to a parent-supplied
 *    score and mark its source. Used when parents want to assert "yes, my
 *    child loves this" or "no, this isn't really them right now".
 * 2. `resetChildInterests` — wipe all interest signals + profile rows + the
 *    derived ChildZpdState. Used when parents request a fresh start. Audit
 *    event is recorded with the actor's userId.
 */

import { prisma } from "@/lib/db";
import {
  createInterestAuditEvent,
  upsertChildInterestProfile,
} from "./repository";
import { rebuildChildInterestProfiles } from "./profile-service";
import { INTEREST_TAXONOMY_VERSION, isInterestKey, type InterestKey } from "./taxonomy";

export interface OverrideInterestInput {
  childId: string;
  parentUserId: string;
  interestKey: InterestKey;
  score: number;
  confidence?: number;
  reason?: string;
}

export async function overrideInterestProfile(input: OverrideInterestInput) {
  if (!isInterestKey(input.interestKey)) {
    throw new Error(`Unknown interest key: ${input.interestKey}`);
  }

  const existing = await prisma.childInterestProfile.findUnique({
    where: {
      childId_taxonomyVersion_interestKey: {
        childId: input.childId,
        taxonomyVersion: INTEREST_TAXONOMY_VERSION,
        interestKey: input.interestKey,
      },
    },
  });

  const newProfile = await upsertChildInterestProfile({
    childId: input.childId,
    interestKey: input.interestKey,
    score: input.score,
    confidence: input.confidence ?? 1,
    signalCount: existing?.signalCount ?? 0,
    distinctDays: existing?.distinctDays ?? 0,
    firstSignalAt: existing?.firstSignalAt ?? null,
    lastSignalAt: existing?.lastSignalAt ?? new Date(),
    trend: existing?.trend ?? "stable",
    stability: existing?.stability ?? "fleeting",
    summary: existing?.summary ?? null,
  });

  await createInterestAuditEvent({
    childId: input.childId,
    actorUserId: input.parentUserId,
    eventType: "parent_interest_profile_overridden",
    entityType: "child_interest_profile",
    entityId: newProfile.id,
    beforeJson: existing ?? undefined,
    afterJson: { score: input.score, confidence: input.confidence ?? 1 },
    metadataJson: { reason: input.reason },
  });

  return newProfile;
}

export interface ResetInterestsInput {
  childId: string;
  parentUserId: string;
  reason?: string;
}

export async function resetChildInterests(input: ResetInterestsInput) {
  const summary = await prisma.$transaction(async (tx) => {
    const signalCount = await tx.interestSignal.count({ where: { childId: input.childId } });
    const profileCount = await tx.childInterestProfile.count({ where: { childId: input.childId } });

    await tx.interestSignal.deleteMany({ where: { childId: input.childId } });
    await tx.childInterestProfile.deleteMany({ where: { childId: input.childId } });
    await tx.missionInterestAssessment.deleteMany({ where: { childId: input.childId } });

    return { signalCount, profileCount };
  });

  await createInterestAuditEvent({
    childId: input.childId,
    actorUserId: input.parentUserId,
    eventType: "parent_interest_profile_reset",
    entityType: "child_interest_profile",
    metadataJson: {
      reason: input.reason,
      deletedSignalCount: summary.signalCount,
      deletedProfileCount: summary.profileCount,
    },
  });

  // Rebuild leaves no profiles (no signals remain). This is idempotent and
  // also writes the standard rebuild audit row so downstream subscribers see
  // a consistent "now-empty" state.
  await rebuildChildInterestProfiles(input.childId);

  return summary;
}
