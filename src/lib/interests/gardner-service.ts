/**
 * Persist Gardner multiple-intelligence scores derived from KidsArtBench.
 *
 * Each discovery session that includes a KidsArtBench score contributes to
 * the child's longitudinal Gardner profile via EMA (α=0.3).
 *
 *   new_score = old_score × 0.7 + incoming_score × 0.3
 *
 * First session: new_score = incoming_score (no prior to blend with).
 */

import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { childGardnerProfiles } from "@/lib/schema";
import { createId } from "@paralleldrive/cuid2";

const EMA_ALPHA = 0.3;

/**
 * Upsert Gardner intelligence scores for a child.
 * @param childId  - child row id
 * @param scores   - Record<intelligence, 0..1> from mapToGardner()
 */
export async function upsertGardnerScores(
  childId: string,
  scores: Record<string, number>,
): Promise<void> {
  const now = new Date();

  await Promise.all(
    Object.entries(scores).map(async ([intelligence, incoming]) => {
      const [existing] = await db
        .select()
        .from(childGardnerProfiles)
        .where(
          and(
            eq(childGardnerProfiles.childId, childId),
            eq(childGardnerProfiles.intelligence, intelligence),
          ),
        )
        .limit(1);

      if (existing) {
        const blended = existing.score * (1 - EMA_ALPHA) + incoming * EMA_ALPHA;
        await db
          .update(childGardnerProfiles)
          .set({
            score: blended,
            sessionCount: existing.sessionCount + 1,
            lastComputedAt: now,
            updatedAt: now,
          })
          .where(eq(childGardnerProfiles.id, existing.id));
      } else {
        await db.insert(childGardnerProfiles).values({
          id: createId(),
          childId,
          intelligence,
          score: incoming,
          sessionCount: 1,
          lastComputedAt: now,
        });
      }
    }),
  );
}

/**
 * Read all Gardner scores for a child, sorted descending by score.
 */
export async function getGardnerScores(
  childId: string,
): Promise<Array<{ intelligence: string; score: number; sessionCount: number }>> {
  const rows = await db
    .select({
      intelligence: childGardnerProfiles.intelligence,
      score: childGardnerProfiles.score,
      sessionCount: childGardnerProfiles.sessionCount,
    })
    .from(childGardnerProfiles)
    .where(eq(childGardnerProfiles.childId, childId))
    .orderBy(childGardnerProfiles.score);

  return rows.sort((a, b) => b.score - a.score);
}
