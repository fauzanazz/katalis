import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import type { ZpdBand } from "./band";

export async function getState(childId: string) {
  return prisma.childZpdState.findUnique({ where: { childId } });
}

export async function upsertState(
  childId: string,
  score: number,
  band: ZpdBand,
  tx?: Prisma.TransactionClient,
) {
  const client = tx ?? prisma;
  return client.childZpdState.upsert({
    where: { childId },
    create: { childId, score, band },
    update: { score, band },
  });
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
  tx?: Prisma.TransactionClient,
) {
  const client = tx ?? prisma;
  return client.childZpdSnapshot.create({
    data: {
      childId: input.childId,
      score: input.score,
      band: input.band,
      reason: input.reason,
      missionId: input.missionId ?? null,
    },
  });
}

export async function listSnapshots(childId: string, limit = 30) {
  return prisma.childZpdSnapshot.findMany({
    where: { childId },
    orderBy: { createdAt: "asc" },
    take: limit,
  });
}

export async function hasFrustrationSnapshotForMission(
  childId: string,
  missionId: string,
) {
  const existing = await prisma.childZpdSnapshot.findFirst({
    where: { childId, missionId, reason: "frustration_sustained" },
    select: { id: true },
  });
  return existing !== null;
}
