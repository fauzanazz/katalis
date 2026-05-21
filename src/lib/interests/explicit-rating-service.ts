import { createInterestAuditEvent, upsertMissionInterestAssessment } from "./repository";
import { ingestInterestSignals } from "./ingest-service";
import type { InterestKey } from "./taxonomy";

const RATING_TO_STRENGTH: Record<1 | 2 | 3 | 4 | 5, number> = {
  1: -0.8,
  2: -0.3,
  3: 0.1,
  4: 0.6,
  5: 1.0,
};

export type SubmitMissionInterestRatingInput = {
  childId: string;
  missionId: string;
  interestKey: InterestKey;
  rating: number;
  rater: "child" | "parent";
  notes?: string;
};

type RatingDeps = {
  upsertAssessment: typeof upsertMissionInterestAssessment;
  ingest: typeof ingestInterestSignals;
  auditEvent: typeof createInterestAuditEvent;
};

function validateRating(rating: number): asserts rating is 1 | 2 | 3 | 4 | 5 {
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new Error("rating must be integer 1..5");
  }
}

async function submitRating(
  input: SubmitMissionInterestRatingInput,
  deps: RatingDeps,
): Promise<void> {
  validateRating(input.rating);

  const strength = RATING_TO_STRENGTH[input.rating];

  await deps.upsertAssessment({
    childId: input.childId,
    missionId: input.missionId,
    interestKey: input.interestKey,
    explicitRating: input.rating,
    parentRating: input.rater === "parent" ? input.rating : undefined,
    childRating: input.rater === "child" ? input.rating : undefined,
    notes: input.notes,
  });

  await deps.ingest({
    childId: input.childId,
    source: input.rater === "child" ? "explicit_child_rating" : "explicit_parent_rating",
    missionId: input.missionId,
    signals: [
      {
        interestKey: input.interestKey,
        dimension: input.rater === "child" ? "joy" : "engagement",
        strength,
        confidence: 1,
      },
    ],
  });

  await deps.auditEvent({
    childId: input.childId,
    eventType: "mission_interest_rating_submitted",
    entityType: "mission_interest_assessment",
    metadataJson: {
      missionId: input.missionId,
      interestKey: input.interestKey,
      rating: input.rating,
      rater: input.rater,
    },
  });
}

export async function submitMissionInterestRating(
  input: SubmitMissionInterestRatingInput,
): Promise<void> {
  return submitRating(input, {
    upsertAssessment: upsertMissionInterestAssessment,
    ingest: ingestInterestSignals,
    auditEvent: createInterestAuditEvent,
  });
}

export { submitRating as _submitMissionInterestRatingWithDeps };
