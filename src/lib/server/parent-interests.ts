import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { eq, and, desc, asc } from "drizzle-orm";

import { getUserSession, getChildSession, isStepUpFresh } from "@/lib/auth-start";
import { db } from "@/lib/db";
import { quests, missions, parentQuestFollows } from "@/lib/schema";
import { ok, err, type Result } from "@/lib/server/result";
import { verifyParentChildLink } from "@/lib/parent/link";
import { getParentInterestInsights } from "@/lib/interests/parent-insight-service";
import {
  overrideInterestProfile,
  resetChildInterests,
} from "@/lib/interests/parent-override-service";
import { mapQuestToInterestSignals } from "@/lib/interests/quest-mapper";
import { INTEREST_TAXONOMY_V1, isInterestKey } from "@/lib/interests/taxonomy";
import { submitMissionInterestRating } from "@/lib/interests/explicit-rating-service";

// ---------------------------------------------------------------------------
// Exported interfaces
// ---------------------------------------------------------------------------

export interface ParentFollowView {
  id: string;
  questId: string;
  childId: string;
  childName: string | null;
  dream: string;
  status: string;
  currentDay: number;
  lastViewedAt: string;
  missions: Array<{ day: number; status: string }>;
  completedCount: number;
  totalCount: number;
}

export interface ParentFollowRow {
  id: string;
  parentId: string;
  childId: string;
  questId: string;
  currentDay: number;
  lastViewedAt: string;
  notifications: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Mission {
  id: string;
  day: number;
  title: string;
  description: string;
  instructions: string;
  materials: string;
  tips: string;
  status: string;
  proofPhotoUrl: string | null;
  phase: string | null;
  intensityHint: number | null;
  intent: string | null;
  estimatedMinutes: number | null;
}

export interface TopInterest {
  interestKey: string;
  score: number;
  confidence: number;
  trend: "rising" | "falling" | "stable";
  stability: "fleeting" | "emerging" | "sustained";
  signalCount: number;
  distinctDays: number;
  firstSignalAt: string | null;
  lastSignalAt: string | null;
  summary: string | null;
  recentEvidence: Array<{ source: string; observedAt: string; dimension: string; strength: number }>;
}

export interface RecentSignal {
  interestKey: string;
  source: string;
  dimension: string;
  strength: number;
  observedAt: string;
}

export interface InterestInsightsData {
  topInterests: TopInterest[];
  recentSignals: RecentSignal[];
  suggestedNextQuestions: string[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toFollowRow(
  f: typeof parentQuestFollows.$inferSelect,
): ParentFollowRow {
  return {
    id: f.id,
    parentId: f.parentId,
    childId: f.childId,
    questId: f.questId,
    currentDay: f.currentDay,
    lastViewedAt: f.lastViewedAt.toISOString(),
    notifications: f.notifications,
    createdAt: f.createdAt.toISOString(),
    updatedAt: f.updatedAt.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// listParentFollowsFn
// ---------------------------------------------------------------------------

export const listParentFollowsFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<Result<{ follows: ParentFollowView[] }>> => {
    const session = await getUserSession();
    if (!session) return err("unauthorized", "Authentication required");

    const follows = await db.query.parentQuestFollows.findMany({
      where: eq(parentQuestFollows.parentId, session.userId),
      with: {
        quest: {
          columns: { id: true, dream: true, status: true },
          with: {
            missions: {
              columns: { day: true, status: true },
              orderBy: asc(missions.day),
            },
          },
        },
        child: { columns: { id: true, name: true } },
      },
      orderBy: desc(parentQuestFollows.updatedAt),
    });

    const result: ParentFollowView[] = follows.map((f) => ({
      id: f.id,
      questId: f.questId,
      childId: f.childId,
      childName: f.child.name,
      dream: f.quest.dream,
      status: f.quest.status,
      currentDay: f.currentDay,
      lastViewedAt: f.lastViewedAt.toISOString(),
      missions: f.quest.missions,
      completedCount: f.quest.missions.filter((m) => m.status === "completed").length,
      totalCount: f.quest.missions.length,
    }));

    return ok({ follows: result });
  },
);

// ---------------------------------------------------------------------------
// getParentQuestDetailFn
// ---------------------------------------------------------------------------

const GetParentQuestDetailSchema = z.object({ id: z.string().min(1) });

export const getParentQuestDetailFn = createServerFn({ method: "GET" })
  .validator((d: unknown) => GetParentQuestDetailSchema.parse(d))
  .handler(
    async ({
      data,
    }): Promise<
      Result<{
        quest: {
          id: string;
          dream: string;
          localContext: string;
          status: string;
          childId: string;
          child: { id: string; name: string | null };
          missions: Mission[];
          discovery: { detectedTalents: string[] } | null;
        };
        currentMission: Mission | null;
        completedCount: number;
        topInterestKey: string;
      }>
    > => {
      const session = await getUserSession();
      if (!session) return err("unauthorized", "Authentication required");

      const quest = await db.query.quests.findFirst({
        where: eq(quests.id, data.id),
        with: {
          child: { columns: { id: true, name: true } },
          missions: { orderBy: (m, { asc: a }) => a(m.day) },
          discovery: { columns: { detectedTalents: true } },
        },
      });

      // 404-not-403: return not_found regardless of why access is denied
      if (!quest) return err("not_found", "Quest not found");

      const isLinked = await verifyParentChildLink(session.userId, quest.childId);
      if (!isLinked) return err("not_found", "Quest not found");

      const missionList: Mission[] = quest.missions.map((m) => ({
        id: m.id,
        day: m.day,
        title: m.title,
        description: m.description,
        instructions: m.instructions,
        materials: m.materials,
        tips: m.tips,
        status: m.status,
        proofPhotoUrl: m.proofPhotoUrl,
        phase: m.phase,
        intensityHint: m.intensityHint,
        intent: m.intent,
        estimatedMinutes: m.estimatedMinutes,
      }));

      const currentMission =
        missionList.find(
          (m) => m.status === "in_progress" || m.status === "available",
        ) ?? missionList[missionList.length - 1] ?? null;

      const completedCount = missionList.filter((m) => m.status === "completed").length;

      let detectedTalents: Array<{ name: string; confidence?: number }> = [];
      if (quest.discovery?.detectedTalents) {
        try {
          detectedTalents = JSON.parse(quest.discovery.detectedTalents) as Array<{
            name: string;
            confidence?: number;
          }>;
        } catch {
          detectedTalents = [];
        }
      }

      const mappedSignals = mapQuestToInterestSignals({
        dream: quest.dream,
        localContext: quest.localContext,
        talents: detectedTalents,
      });
      const topInterestKey = mappedSignals[0]?.interestKey ?? "science";

      const detectedTalentNames = detectedTalents.map((t) => t.name);

      return ok({
        quest: {
          id: quest.id,
          dream: quest.dream,
          localContext: quest.localContext,
          status: quest.status,
          childId: quest.childId,
          child: { id: quest.child.id, name: quest.child.name },
          missions: missionList,
          discovery: quest.discovery ? { detectedTalents: detectedTalentNames } : null,
        },
        currentMission,
        completedCount,
        topInterestKey,
      });
    },
  );

// ---------------------------------------------------------------------------
// markQuestFollowedFn — render-time upsert extracted from quest page
// ---------------------------------------------------------------------------

const MarkQuestFollowedSchema = z.object({
  questId: z.string().min(1),
});

export const markQuestFollowedFn = createServerFn({ method: "POST" })
  .validator((d: unknown) => MarkQuestFollowedSchema.parse(d))
  .handler(
    async ({ data }): Promise<Result<{ followed: true }>> => {
      const session = await getUserSession();
      if (!session) return err("unauthorized", "Authentication required");

      // Derive childId from the quest server-side (the original render-time
      // upsert used quest.childId) — never trust a client-supplied childId, or a
      // parent linked to two children could write a follow row with a mismatched
      // childId column.
      const quest = await db.query.quests.findFirst({
        where: eq(quests.id, data.questId),
        columns: { id: true, childId: true },
      });
      if (!quest) return err("not_found", "Quest not found");

      const isLinked = await verifyParentChildLink(session.userId, quest.childId);
      if (!isLinked) return err("forbidden", "Not linked to this child");

      await db
        .insert(parentQuestFollows)
        .values({
          parentId: session.userId,
          childId: quest.childId,
          questId: quest.id,
        })
        .onConflictDoUpdate({
          target: [parentQuestFollows.parentId, parentQuestFollows.questId],
          set: { lastViewedAt: new Date() },
        });

      return ok({ followed: true as const });
    },
  );

// ---------------------------------------------------------------------------
// followQuestFn — POST (was POST /api/parent/follow/[questId])
// ---------------------------------------------------------------------------

const FollowQuestSchema = z.object({ questId: z.string().min(1) });

export const followQuestFn = createServerFn({ method: "POST" })
  .validator((d: unknown) => FollowQuestSchema.parse(d))
  .handler(
    async ({ data }): Promise<Result<{ follow: ParentFollowRow }>> => {
      const session = await getUserSession();
      if (!session) return err("unauthorized", "Authentication required");

      const quest = await db.query.quests.findFirst({
        where: eq(quests.id, data.questId),
        columns: { id: true, childId: true },
      });
      if (!quest) return err("not_found", "Quest not found");

      const isLinked = await verifyParentChildLink(session.userId, quest.childId);
      if (!isLinked) return err("forbidden", "Not linked to this child");

      const [follow] = await db
        .insert(parentQuestFollows)
        .values({
          parentId: session.userId,
          childId: quest.childId,
          questId: data.questId,
        })
        .onConflictDoUpdate({
          target: [parentQuestFollows.parentId, parentQuestFollows.questId],
          set: { lastViewedAt: new Date() },
        })
        .returning();

      return ok({ follow: toFollowRow(follow) });
    },
  );

// ---------------------------------------------------------------------------
// unfollowQuestFn — POST (was DELETE /api/parent/follow/[questId])
// Scoped by parentId only — no link check (preserves original)
// ---------------------------------------------------------------------------

const UnfollowQuestSchema = z.object({ questId: z.string().min(1) });

export const unfollowQuestFn = createServerFn({ method: "POST" })
  .validator((d: unknown) => UnfollowQuestSchema.parse(d))
  .handler(
    async ({ data }): Promise<Result<{ unfollowed: true }>> => {
      const session = await getUserSession();
      if (!session) return err("unauthorized", "Authentication required");

      await db
        .delete(parentQuestFollows)
        .where(
          and(
            eq(parentQuestFollows.parentId, session.userId),
            eq(parentQuestFollows.questId, data.questId),
          ),
        );

      return ok({ unfollowed: true as const });
    },
  );

// ---------------------------------------------------------------------------
// updateFollowProgressFn — POST (was PATCH /api/parent/follow/[questId])
// ---------------------------------------------------------------------------

const UpdateFollowProgressSchema = z.object({
  questId: z.string().min(1),
  currentDay: z.number().int().positive().optional(),
});

export const updateFollowProgressFn = createServerFn({ method: "POST" })
  .validator((d: unknown) => UpdateFollowProgressSchema.parse(d))
  .handler(
    async ({ data }): Promise<Result<{ follow: ParentFollowRow }>> => {
      const session = await getUserSession();
      if (!session) return err("unauthorized", "Authentication required");

      const [follow] = await db
        .update(parentQuestFollows)
        .set({
          currentDay: data.currentDay ?? undefined,
          lastViewedAt: new Date(),
        })
        .where(
          and(
            eq(parentQuestFollows.parentId, session.userId),
            eq(parentQuestFollows.questId, data.questId),
          ),
        )
        .returning();

      return ok({ follow: toFollowRow(follow) });
    },
  );

// ---------------------------------------------------------------------------
// getChildInterestInsightsFn
// ---------------------------------------------------------------------------

const GetChildInterestInsightsSchema = z.object({ childId: z.string().min(1) });

export const getChildInterestInsightsFn = createServerFn({ method: "GET" })
  .validator((d: unknown) => GetChildInterestInsightsSchema.parse(d))
  .handler(
    async ({ data }): Promise<Result<{ insights: InterestInsightsData }>> => {
      const session = await getUserSession();
      if (!session) return err("unauthorized", "Authentication required");

      const isLinked = await verifyParentChildLink(session.userId, data.childId);
      if (!isLinked) return err("forbidden", "Access denied");

      // getParentInterestInsights throws on unexpected DB errors — let those bubble as 500
      const raw = await getParentInterestInsights(data.childId);

      const insights: InterestInsightsData = {
        topInterests: raw.topInterests,
        recentSignals: raw.recentSignals,
        suggestedNextQuestions: raw.suggestedNextQuestions,
      };

      return ok({ insights });
    },
  );

// ---------------------------------------------------------------------------
// overrideChildInterestFn
// ---------------------------------------------------------------------------

const OverrideChildInterestSchema = z.object({
  childId: z.string().min(1),
  interestKey: z.enum(INTEREST_TAXONOMY_V1),
  score: z.number().min(0).max(1),
  confidence: z.number().min(0).max(1).optional(),
  reason: z.string().max(500).optional(),
});

export const overrideChildInterestFn = createServerFn({ method: "POST" })
  .validator((d: unknown) => OverrideChildInterestSchema.parse(d))
  .handler(
    async ({ data }): Promise<Result<{ insights: InterestInsightsData }>> => {
      const session = await getUserSession();
      if (!session) return err("unauthorized", "Authentication required");

      const isLinked = await verifyParentChildLink(session.userId, data.childId);
      if (!isLinked) return err("forbidden", "Access denied");

      await overrideInterestProfile({
        childId: data.childId,
        parentUserId: session.userId,
        interestKey: data.interestKey,
        score: data.score,
        confidence: data.confidence,
        reason: data.reason,
      });

      const raw = await getParentInterestInsights(data.childId);
      const insights: InterestInsightsData = {
        topInterests: raw.topInterests,
        recentSignals: raw.recentSignals,
        suggestedNextQuestions: raw.suggestedNextQuestions,
      };

      return ok({ insights });
    },
  );

// ---------------------------------------------------------------------------
// resetChildInterestsFn — STEP-UP GATED
// ---------------------------------------------------------------------------

const ResetChildInterestsSchema = z.object({
  childId: z.string().min(1),
  reason: z.string().max(500).optional(),
});

export const resetChildInterestsFn = createServerFn({ method: "POST" })
  .validator((d: unknown) => ResetChildInterestsSchema.parse(d))
  .handler(
    async ({
      data,
    }): Promise<Result<{ deleted: { signalCount: number; profileCount: number } }>> => {
      const session = await getUserSession();
      if (!session) return err("unauthorized", "Authentication required");

      // Step-up before ownership — matches original DELETE handler order
      if (!(await isStepUpFresh())) return err("step_up_required", "Password re-authentication required");

      const isLinked = await verifyParentChildLink(session.userId, data.childId);
      if (!isLinked) return err("forbidden", "Access denied");

      const summary = await resetChildInterests({
        childId: data.childId,
        parentUserId: session.userId,
        reason: data.reason,
      });

      return ok({ deleted: { signalCount: summary.signalCount, profileCount: summary.profileCount } });
    },
  );

// ---------------------------------------------------------------------------
// submitInterestRatingFn
// ---------------------------------------------------------------------------

const SubmitInterestRatingSchema = z.object({
  childId: z.string().min(1),
  missionId: z.string().min(1),
  interestKey: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  rater: z.enum(["parent", "child"]),
  notes: z.string().optional(),
});

export const submitInterestRatingFn = createServerFn({ method: "POST" })
  .validator((d: unknown) => SubmitInterestRatingSchema.parse(d))
  .handler(
    async ({ data }): Promise<Result<{ rated: true }>> => {
      const { childId, missionId, interestKey, rating, rater, notes } = data;

      if (!isInterestKey(interestKey)) {
        return err("invalid", `Unknown interest key: ${interestKey}`);
      }

      // Auth differs by rater, matching the original /api/interests/rating route:
      // a parent rater proves the parent-child link; a child rater proves their
      // own child session. Do NOT collapse these — a parent must not be able to
      // attribute a "child" rating, and a real child has no parent userId.
      if (rater === "parent") {
        const parentSession = await getUserSession();
        if (!parentSession) return err("unauthorized", "Authentication required");
        const isLinked = await verifyParentChildLink(parentSession.userId, childId);
        if (!isLinked) return err("forbidden", "Access denied");
      } else {
        const childSession = await getChildSession();
        if (!childSession) return err("unauthorized", "Authentication required");
        if (childSession.childId !== childId) return err("forbidden", "Access denied");
      }

      // Verify mission belongs to this child via quest relation
      const mission = await db.query.missions.findFirst({
        where: eq(missions.id, missionId),
        with: { quest: { columns: { childId: true } } },
        columns: { id: true },
      });
      if (!mission || mission.quest.childId !== childId) {
        return err("forbidden", "Access denied");
      }

      await submitMissionInterestRating({
        childId,
        missionId,
        interestKey: interestKey as Parameters<typeof submitMissionInterestRating>[0]["interestKey"],
        rating,
        rater,
        notes,
      });

      return ok({ rated: true as const });
    },
  );
