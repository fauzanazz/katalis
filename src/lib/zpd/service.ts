import { db } from "@/lib/db";
import { childZpdStates } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { scoreToBand } from "./band";
import { computeNextScore, type ZpdOutcome } from "./update";
import {
  appendSnapshot,
  getState,
  hasFrustrationSnapshotForMission,
  upsertState,
} from "./repository";

const DEFAULT_BASELINE_SCORE = 0.3;

export async function getZpdScore(childId: string): Promise<number> {
  const state = await getState(childId);
  return state?.score ?? DEFAULT_BASELINE_SCORE;
}

export type RecordZpdEventInput = {
  childId: string;
  outcome: ZpdOutcome;
  missionId?: string | null;
};

export async function recordZpdEvent(input: RecordZpdEventInput) {
  const { childId, outcome, missionId } = input;

  if (outcome === "frustration_sustained" && missionId) {
    const dedupe = await hasFrustrationSnapshotForMission(childId, missionId);
    if (dedupe) return null;
  }

  return db.transaction(async (tx) => {
    const state = await tx.query.childZpdStates.findFirst({ where: eq(childZpdStates.childId, childId) });
    const currentScore = state?.score ?? DEFAULT_BASELINE_SCORE;
    const lastUpdate = state?.updatedAt ?? null;
    const daysSinceLastUpdate = lastUpdate
      ? Math.max(0, daysBetween(lastUpdate, new Date()))
      : 0;

    const nextScore = computeNextScore(
      currentScore,
      outcome,
      daysSinceLastUpdate,
    );
    const nextBand = scoreToBand(nextScore);

    await upsertState(childId, nextScore, nextBand, tx);

    const reason = outcomeToReason(outcome);
    return appendSnapshot(
      { childId, score: nextScore, band: nextBand, reason, missionId },
      tx,
    );
  });
}

function daysBetween(a: Date, b: Date): number {
  const ms = Math.abs(b.getTime() - a.getTime());
  return ms / (1000 * 60 * 60 * 24);
}

function outcomeToReason(
  outcome: ZpdOutcome,
): "mission_completed" | "reflection_submitted" | "frustration_sustained" | "mission_abandoned" {
  switch (outcome) {
    case "completion":
    case "completion_with_frustration":
      return "mission_completed";
    case "completion_strong_reflection":
      return "reflection_submitted";
    case "frustration_sustained":
      return "frustration_sustained";
    case "abandoned":
      return "mission_abandoned";
  }
}
