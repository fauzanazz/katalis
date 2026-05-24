import { db } from "@/lib/db";
import type { DbOrTx } from "@/lib/db";
import { childZpdStates, childZpdSnapshots } from "@/lib/schema";
import { eq, and, asc } from "drizzle-orm";
import type { ZpdBand } from "./band";

export async function getState(childId: string) {
  return db.query.childZpdStates.findFirst({ where: eq(childZpdStates.childId, childId) });
}

export async function upsertState(
  childId: string,
  score: number,
  band: ZpdBand,
  tx?: DbOrTx,
) {
  const client = tx ?? db;
  return (
    await client
      .insert(childZpdStates)
      .values({ childId, score, band })
      .onConflictDoUpdate({
        target: childZpdStates.childId,
        set: { score, band },
      })
      .returning()
  )[0];
}

export type AppendSnapshotInput = {
  childId: string;
  score: number;
  band: ZpdBand;
  reason:
    | "baseline"
    | "mission_completed"
    | "reflection_submitted"
    | "frustration_sustained"
    | "mission_abandoned";
  missionId?: string | null;
};

export async function appendSnapshot(
  input: AppendSnapshotInput,
  tx?: DbOrTx,
) {
  const client = tx ?? db;
  return (
    await client
      .insert(childZpdSnapshots)
      .values({
        childId: input.childId,
        score: input.score,
        band: input.band,
        reason: input.reason,
        missionId: input.missionId ?? null,
      })
      .returning()
  )[0];
}

export async function listSnapshots(childId: string, limit = 30) {
  return db.query.childZpdSnapshots.findMany({
    where: eq(childZpdSnapshots.childId, childId),
    orderBy: asc(childZpdSnapshots.createdAt),
    limit,
  });
}

export async function hasFrustrationSnapshotForMission(
  childId: string,
  missionId: string,
) {
  const existing = await db.query.childZpdSnapshots.findFirst({
    where: and(
      eq(childZpdSnapshots.childId, childId),
      eq(childZpdSnapshots.missionId, missionId),
      eq(childZpdSnapshots.reason, "frustration_sustained"),
    ),
    columns: { id: true },
  });
  return existing != null;
}
