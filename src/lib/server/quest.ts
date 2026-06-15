import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { eq, desc, asc, count } from "drizzle-orm";

import { getChildSession } from "@/lib/auth-start";
import { db } from "@/lib/db";
import {
  quests,
  missions,
  children,
  childInterestProfiles,
  discoveries,
  galleryEntries,
  mentorSessions,
} from "@/lib/schema";
import { ok, err } from "@/lib/server/result";
import { sanitizeInput } from "@/lib/sanitize";
import { isAllowedStorageUrl } from "@/lib/url-allowlist";
import { QuestGenerationInputSchema } from "@/lib/ai/quest-schemas";
import { generateQuest } from "@/lib/ai/client";
import { moderateContent } from "@/lib/moderation";
import { mapQuestToInterestSignals, mapMissionCompletionToInterestSignals } from "@/lib/interests/quest-mapper";
import { ingestInterestSignals } from "@/lib/interests/ingest-service";
import { getZpdScore, recordZpdEvent } from "@/lib/zpd";
import { getAgeGroup } from "@/lib/age";
import { buildAgeConstraintPromptFragment, clampOrRejectMissions } from "@/lib/ai/quest/age-caps";
import {
  pickExplorationInterests,
  shouldIncludeExploration,
  type ProfileSummary,
} from "@/lib/ai/quest/exploration";
import { isInterestKey } from "@/lib/interests/taxonomy";
import { mapToGardner } from "@/lib/ai/kidsartbench-schemas";
import type { KidsArtBenchScore } from "@/lib/ai/kidsartbench-schemas";
import { buildBadgeContext, evaluateBadges, awardBadges } from "@/lib/badges";
import {
  applyAssessmentToSignals,
  assessMissionEngagement,
  type MissionEngagementMetrics,
} from "@/lib/interests/mission-reassessment";
import { geocodeLocationText } from "@/lib/geocoding";
import { stripLocalContext } from "@/lib/privacy/quest-context";

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const GetQuestByIdInputSchema = z.object({ id: z.string() });
const AbandonQuestInputSchema = z.object({ id: z.string() });

export const MissionUpdateSchema = z.object({
  questId: z.string(),
  missionId: z.string(),
  action: z.enum(["start", "complete"]),
  proofPhotoUrl: z.string().url().optional(),
});

export const QuestCompleteSchema = z.union([
  z.object({
    id: z.string(),
    selectedPhotoUrl: z.string().url(),
    skipGallery: z.literal(false).optional(),
  }),
  z.object({
    id: z.string(),
    skipGallery: z.literal(true),
  }),
]);

// Re-export for consumers
export { QuestGenerationInputSchema };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const FRUSTRATION_RANK = { none: 0, low: 1, medium: 2, high: 3 } as const;
type FrustrationKey = keyof typeof FRUSTRATION_RANK;

function extractPeakFrustration(
  messages: Array<{ meta: string | null; role: string }>,
): FrustrationKey {
  let peak: FrustrationKey = "none";
  for (const m of messages) {
    if (m.role !== "mentor" || !m.meta) continue;
    try {
      const parsed = JSON.parse(m.meta) as { frustrationLevel?: string };
      const level = parsed.frustrationLevel;
      if (level && level in FRUSTRATION_RANK) {
        if (FRUSTRATION_RANK[level as FrustrationKey] > FRUSTRATION_RANK[peak]) {
          peak = level as FrustrationKey;
        }
      }
    } catch {
      // Ignore malformed meta
    }
  }
  return peak;
}

function safeParseJSON<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

async function runQuestCompletedSignals({
  childId,
  questId,
  dream,
  localContext,
  detectedTalents,
}: {
  childId: string;
  questId: string;
  dream: string;
  localContext: string;
  detectedTalents: Array<{ name: string; confidence: number }>;
}): Promise<void> {
  try {
    const completionSignals = mapQuestToInterestSignals({ dream, localContext, detectedTalents });
    const persistenceSignals = completionSignals.map((s) => ({
      ...s,
      dimension: "persistence" as const,
      strength: 0.7,
      confidence: 0.75,
    }));
    if (persistenceSignals.length > 0) {
      await ingestInterestSignals({
        childId,
        source: "quest_completed",
        questId,
        signals: persistenceSignals,
      });
    }
  } catch (interestError) {
    console.error("Interest ingestion failed for quest completion, continuing:", interestError);
  }
}

// ---------------------------------------------------------------------------
// listQuestsFn
// ---------------------------------------------------------------------------

export const listQuestsFn = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const session = await getChildSession();
    if (!session) {
      return err("unauthorized", "Authentication required");
    }

    const questRows = await db.query.quests.findMany({
      where: eq(quests.childId, session.childId),
      orderBy: desc(quests.createdAt),
      with: {
        missions: {
          orderBy: asc(missions.day),
          columns: {
            day: true,
            title: true,
            status: true,
          },
        },
      },
    });

    const questList = questRows.map((quest) => {
      const completedCount = quest.missions.filter((m) => m.status === "completed").length;
      return {
        id: quest.id,
        dream: quest.dream,
        status: quest.status,
        createdAt: quest.createdAt.toISOString(),
        completedCount,
        totalMissions: quest.missions.length,
        missions: quest.missions.map((m) => ({
          day: m.day,
          title: m.title,
          status: m.status,
        })),
      };
    });

    return ok({ quests: questList });
  } catch (error) {
    console.error("Quest list error:", error);
    return err("server_error", "Failed to fetch quests");
  }
});

// ---------------------------------------------------------------------------
// generateQuestFn
// ---------------------------------------------------------------------------

export const generateQuestFn = createServerFn({ method: "POST" })
  .validator((d: unknown) =>
    QuestGenerationInputSchema.pick({
      dream: true,
      localContext: true,
      talents: true,
      discoveryId: true,
      guestDob: true,
    }).parse(d),
  )
  .handler(async ({ data }) => {
    try {
      const session = await getChildSession();

      // Sanitize user text inputs unconditionally (XSS prevention)
      let { dream, localContext } = data;
      dream = sanitizeInput(dream);
      localContext = sanitizeInput(localContext);

      const { talents, discoveryId, guestDob } = data;

      // Moderate dream and context text for child safety
      const combinedText = `${dream} ${localContext}`;
      const moderationResult = await moderateContent({
        content: combinedText,
        contentType: "text",
        sourceType: "quest",
        childId: session?.childId,
      });

      if (!moderationResult.allowed) {
        // PRESERVE: content_blocked returns ok (HTTP 200) — NOT err
        return ok({
          error: "content_blocked" as const,
          message:
            moderationResult.redirectMessage ??
            "This content cannot be processed. Let's try something else!",
          redirect: true,
        });
      }

      // Read ZPD anchor for this child (default baseline for guests / first-time)
      const zpdScore = session ? await getZpdScore(session.childId) : undefined;

      // Resolve child age band
      let ageGroup: ReturnType<typeof getAgeGroup>["band"] = "unknown";
      if (session?.childId) {
        const child = await db.query.children.findFirst({
          where: eq(children.id, session.childId),
          columns: { dateOfBirth: true },
        });
        ageGroup = getAgeGroup(child?.dateOfBirth).band;
      } else if (guestDob) {
        ageGroup = getAgeGroup(new Date(guestDob)).band;
      }

      // Pygmalion safeguard (§8.1b): periodically inject exploration interests
      let explorationInterests: string[] | undefined;
      if (session?.childId) {
        const profileRows = (await db.query.childInterestProfiles.findMany({
          where: eq(childInterestProfiles.childId, session.childId),
          orderBy: desc(childInterestProfiles.score),
          limit: 20,
          columns: { interestKey: true, score: true },
        })) as Array<{ interestKey: string; score: number }>;
        const validProfiles: ProfileSummary[] = profileRows.flatMap((p) =>
          isInterestKey(p.interestKey) ? [{ interestKey: p.interestKey, score: p.score }] : [],
        );
        if (shouldIncludeExploration(validProfiles)) {
          explorationInterests = pickExplorationInterests(validProfiles);
        }
      }

      // Enrich with Gardner intelligence profile from artwork analysis
      let artworkSignals:
        | { gardnerScores: Record<string, number>; dominantIntelligences: string[] }
        | undefined;
      if (discoveryId && session?.childId) {
        try {
          const discovery = await db.query.discoveries.findFirst({
            where: eq(discoveries.id, discoveryId),
            columns: { aiAnalysis: true },
          });
          if (discovery?.aiAnalysis) {
            const analysisJson = JSON.parse(discovery.aiAnalysis) as {
              kidsArtBench?: KidsArtBenchScore;
            };
            if (analysisJson.kidsArtBench) {
              const gardnerScores = mapToGardner(analysisJson.kidsArtBench);
              const dominantIntelligences = Object.entries(gardnerScores)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 3)
                .map(([k]) => k);
              artworkSignals = { gardnerScores, dominantIntelligences };
            }
          }
        } catch {
          // Non-fatal — proceed without artwork signals
        }
      }

      // Generate quest; validate per-band duration cap; retry once on violation
      let result = await generateQuest({
        dream,
        localContext,
        talents,
        discoveryId,
        zpdScore,
        ageGroup,
        explorationInterests,
        artworkSignals,
      });

      let cap = clampOrRejectMissions(result.missions, ageGroup);
      if (!cap.ok) {
        const stricterContext = `${localContext}\n\n${buildAgeConstraintPromptFragment(ageGroup)}`;
        result = await generateQuest({
          dream,
          localContext: stricterContext,
          talents,
          discoveryId,
          zpdScore,
          ageGroup,
          explorationInterests,
          artworkSignals,
        });
        cap = clampOrRejectMissions(result.missions, ageGroup);
        if (!cap.ok) {
          console.error(
            "Quest generation exceeded age-band duration cap after retry:",
            cap.reason,
          );
          return err(
            "ai_failure",
            "We couldn't tailor a quest for this age right now. Please try again!",
          );
        }
      }

      // Guest path: skip DB and return preview only
      if (!session) {
        const guestMissions = result.missions.map((mission) => ({
          day: mission.day,
          title: mission.title,
          description: mission.description,
          instructions: mission.instructions,
          materials: mission.materials,
          tips: mission.tips,
          estimatedMinutes: mission.estimatedMinutes,
          status: mission.day === 1 ? "available" : "locked",
        }));
        return ok({ missions: guestMissions, guest: true as const });
      }

      // Authenticated path: verify discovery exists then persist
      const [discoveryCountRow] = await db
        .select({ count: count() })
        .from(discoveries)
        .where(eq(discoveries.childId, session.childId));

      if (discoveryCountRow.count === 0) {
        return err(
          "no_discovery",
          "You need to complete a talent discovery before creating a quest.",
        );
      }

      // Create Quest record
      const [quest] = await db
        .insert(quests)
        .values({
          childId: session.childId,
          discoveryId: discoveryId ?? null,
          dream,
          localContext,
          status: "active",
          generatedAt: new Date(),
        })
        .returning();

      // Create Mission records
      await db.insert(missions).values(
        result.missions.map((mission) => ({
          questId: quest.id,
          day: mission.day,
          title: mission.title,
          description: mission.description,
          instructions: JSON.stringify(mission.instructions),
          materials: JSON.stringify(mission.materials),
          tips: JSON.stringify(mission.tips),
          status: mission.day === 1 ? "available" : "locked",
          phase: mission.phase ?? null,
          intensityHint: mission.intensityHint ?? null,
          intent: mission.intent ?? null,
          estimatedMinutes: mission.estimatedMinutes,
        })),
      );

      const missionList = await db.query.missions.findMany({
        where: eq(missions.questId, quest.id),
        orderBy: missions.day,
      });

      const missionResponse = missionList.map((m) => ({
        day: m.day,
        title: m.title,
        description: m.description,
        instructions: JSON.parse(m.instructions) as string[],
        materials: JSON.parse(m.materials) as string[],
        tips: JSON.parse(m.tips) as string[],
        status: m.status,
        estimatedMinutes: m.estimatedMinutes,
      }));

      // Ingest quest-started interest signals (fire-and-forget)
      try {
        const signals = mapQuestToInterestSignals({ dream, localContext, talents });
        if (signals.length > 0) {
          await ingestInterestSignals({
            childId: session.childId,
            source: "quest_started",
            questId: quest.id,
            signals,
          });
        }
      } catch (interestError) {
        console.error(
          "Interest ingestion failed for quest generation, continuing:",
          interestError,
        );
      }

      return ok({ id: quest.id, missions: missionResponse });
    } catch (error) {
      console.error("Quest generation error:", error);

      if (error instanceof Error && error.message.includes("timed out")) {
        return err("timeout", "Quest generation is taking too long. Please try again.");
      }

      return err("ai_failure", "We couldn't create your quest right now. Please try again!");
    }
  });

// ---------------------------------------------------------------------------
// getQuestByIdFn
// ---------------------------------------------------------------------------

export const getQuestByIdFn = createServerFn({ method: "GET" })
  .validator((d: unknown) => GetQuestByIdInputSchema.parse(d))
  .handler(async ({ data }) => {
    try {
      const session = await getChildSession();
      if (!session) {
        return err("unauthorized", "Authentication required");
      }

      const quest = await db.query.quests.findFirst({
        where: eq(quests.id, data.id),
        with: {
          missions: { orderBy: asc(missions.day) },
          discovery: true,
        },
      });

      if (!quest) {
        return err("not_found", "Quest not found");
      }

      if (quest.childId !== session.childId) {
        return err("forbidden", "Access denied");
      }

      const missionList = quest.missions.map((m) => ({
        id: m.id,
        day: m.day,
        title: m.title,
        description: m.description,
        instructions: safeParseJSON(m.instructions, [] as string[]),
        materials: safeParseJSON(m.materials, [] as string[]),
        tips: safeParseJSON(m.tips, [] as string[]),
        status: m.status,
        proofPhotoUrl: m.proofPhotoUrl,
      }));

      const completedCount = missionList.filter((m) => m.status === "completed").length;
      const detectedTalents = quest.discovery?.detectedTalents
        ? safeParseJSON(quest.discovery.detectedTalents, [] as Array<{ name: string; confidence: number }>)
        : [] as Array<{ name: string; confidence: number }>;

      return ok({
        id: quest.id,
        dream: quest.dream,
        localContext: quest.localContext,
        status: quest.status,
        generatedAt: quest.generatedAt?.toISOString() ?? null,
        createdAt: quest.createdAt.toISOString(),
        missions: missionList,
        completedCount,
        totalMissions: missionList.length,
        detectedTalents,
      });
    } catch (error) {
      console.error("Quest fetch error:", error);
      return err("server_error", "Failed to fetch quest");
    }
  });

// ---------------------------------------------------------------------------
// abandonQuestFn
// ---------------------------------------------------------------------------

export const abandonQuestFn = createServerFn({ method: "POST" })
  .validator((d: unknown) => AbandonQuestInputSchema.parse(d))
  .handler(async ({ data }) => {
    try {
      const session = await getChildSession();
      if (!session) {
        return err("unauthorized", "Authentication required");
      }

      const quest = await db.query.quests.findFirst({
        where: eq(quests.id, data.id),
      });

      if (!quest) {
        return err("not_found", "Quest not found");
      }

      if (quest.childId !== session.childId) {
        return err("forbidden", "Access denied");
      }

      if (quest.status !== "active") {
        return err("invalid_state", `Cannot abandon a ${quest.status} quest`);
      }

      await db.transaction(async (tx) => {
        await tx.update(quests).set({ status: "abandoned" }).where(eq(quests.id, data.id));
        await tx.update(missions).set({ status: "locked" }).where(eq(missions.questId, data.id));
      });

      return ok({ success: true as const, message: "Quest abandoned successfully" });
    } catch (error) {
      console.error("Quest abandon error:", error);
      return err("server_error", "Failed to abandon quest");
    }
  });

// ---------------------------------------------------------------------------
// updateMissionFn
// ---------------------------------------------------------------------------

export const updateMissionFn = createServerFn({ method: "POST" })
  .validator((d: unknown) => MissionUpdateSchema.parse(d))
  .handler(async ({ data }) => {
    try {
      const session = await getChildSession();
      if (!session) {
        return err("unauthorized", "Authentication required");
      }

      const { questId, missionId, action } = data;
      let { proofPhotoUrl } = data;

      // Sanitize URL input unconditionally (XSS prevention + URL origin check)
      if (proofPhotoUrl && typeof proofPhotoUrl === "string") {
        proofPhotoUrl = sanitizeInput(proofPhotoUrl);
        if (!isAllowedStorageUrl(proofPhotoUrl)) {
          return err("invalid", "Invalid proof photo URL");
        }
      }

      const quest = await db.query.quests.findFirst({
        where: eq(quests.id, questId),
        with: { missions: { orderBy: asc(missions.day) } },
      });

      if (!quest) {
        return err("not_found", "Quest not found");
      }

      if (quest.childId !== session.childId) {
        return err("forbidden", "Access denied");
      }

      if (quest.status !== "active") {
        return err("invalid_state", `Cannot modify missions on a ${quest.status} quest`);
      }

      const mission = quest.missions.find((m) => m.id === missionId);
      if (!mission) {
        return err("not_found", "Mission not found");
      }

      // Handle "start" action
      if (action === "start") {
        if (mission.status !== "available") {
          return err(
            "invalid_state",
            `Cannot start a mission with status "${mission.status}". Only "available" missions can be started.`,
          );
        }

        const [updatedMission] = await db
          .update(missions)
          .set({ status: "in_progress" })
          .where(eq(missions.id, missionId))
          .returning();

        // Auto-create mentor session for this mission
        const existingSession = await db.query.mentorSessions.findFirst({
          where: eq(mentorSessions.missionId, missionId),
        });
        if (!existingSession) {
          await db.insert(mentorSessions).values({
            missionId,
            childId: session.childId,
            questId,
            status: "active",
          });
        }

        return ok({
          success: true as const,
          mission: {
            id: updatedMission.id,
            day: updatedMission.day,
            status: updatedMission.status,
          },
          nextDayUnlocked: false,
          questCompleted: false,
          newBadges: undefined,
        });
      }

      // Handle "complete" action
      if (mission.status !== "in_progress") {
        return err(
          "invalid_state",
          `Cannot complete a mission with status "${mission.status}". Only "in_progress" missions can be completed.`,
        );
      }

      if (!proofPhotoUrl) {
        return err("missing_proof", "A proof photo is required to complete the mission.");
      }

      const txResult = await db.transaction(async (tx) => {
        const [completedMission] = await tx
          .update(missions)
          .set({ status: "completed", proofPhotoUrl })
          .where(eq(missions.id, missionId))
          .returning();

        const nextMission = quest.missions.find((m) => m.day === mission.day + 1);
        if (nextMission && nextMission.status === "locked") {
          await tx
            .update(missions)
            .set({ status: "available" })
            .where(eq(missions.id, nextMission.id));
        }

        const allMissions = await tx
          .select({ status: missions.status })
          .from(missions)
          .where(eq(missions.questId, questId));

        const allCompleted = allMissions.every((m) => m.status === "completed");
        if (allCompleted) {
          await tx.update(quests).set({ status: "completed" }).where(eq(quests.id, questId));
        }

        return {
          completedMission,
          nextDayUnlocked: nextMission ? nextMission.status === "locked" : false,
          questCompleted: allCompleted,
        };
      });

      // Award badges
      const badgeCtx = await buildBadgeContext({ childId: session.childId, questId });
      const newBadgeSlugs = evaluateBadges(badgeCtx);
      const newBadges = await awardBadges({
        childId: session.childId,
        newlyEarnedSlugs: newBadgeSlugs,
        trigger: "mission_complete",
        questId,
      });

      // Reassess interest prediction vs actual engagement (spec §6.2)
      try {
        const mentorSession = await db.query.mentorSessions.findFirst({
          where: eq(mentorSessions.missionId, missionId),
          with: {
            messages: { columns: { meta: true, role: true } },
            adjustments: { columns: { id: true } },
          },
        });
        const peakFrustration = mentorSession
          ? extractPeakFrustration(mentorSession.messages)
          : "none";
        const metrics: MissionEngagementMetrics = {
          completed: true,
          adjustmentCount: mentorSession?.adjustments.length ?? 0,
          peakFrustration,
        };
        const assessment = assessMissionEngagement(metrics);
        const missionSignals = mapMissionCompletionToInterestSignals({
          quest: { dream: quest.dream, localContext: quest.localContext },
          mission: { title: mission.title, description: mission.description },
        });
        if (missionSignals.length > 0) {
          const adjustedSignals = applyAssessmentToSignals(missionSignals, assessment);
          await ingestInterestSignals({
            childId: session.childId,
            source: "mission_completed",
            questId,
            missionId,
            signals: adjustedSignals,
          });
        }
      } catch (interestError) {
        console.error(
          "Interest reassessment failed for mission completion, continuing:",
          interestError,
        );
      }

      // Record ZPD event (fire-and-forget)
      try {
        await recordZpdEvent({ childId: session.childId, outcome: "completion", missionId });
      } catch (zpdError) {
        console.error(
          "ZPD event recording failed for mission completion, continuing:",
          zpdError,
        );
      }

      return ok({
        success: true as const,
        mission: {
          id: txResult.completedMission.id,
          day: txResult.completedMission.day,
          status: txResult.completedMission.status,
          proofPhotoUrl: txResult.completedMission.proofPhotoUrl,
        },
        nextDayUnlocked: txResult.nextDayUnlocked,
        questCompleted: txResult.questCompleted,
        newBadges: newBadges.length > 0 ? newBadges : undefined,
      });
    } catch (error) {
      console.error("Mission update error:", error);
      return err("server_error", "Failed to update mission");
    }
  });

// ---------------------------------------------------------------------------
// completeQuestFn
// ---------------------------------------------------------------------------

export const completeQuestFn = createServerFn({ method: "POST" })
  .validator((d: unknown) => QuestCompleteSchema.parse(d))
  .handler(async ({ data }) => {
    try {
      const session = await getChildSession();
      if (!session) {
        return err("unauthorized", "Authentication required");
      }

      const questId = data.id;

      const quest = await db.query.quests.findFirst({
        where: eq(quests.id, questId),
        with: {
          missions: { orderBy: asc(missions.day) },
          discovery: true,
        },
      });

      if (!quest) {
        return err("not_found", "Quest not found");
      }

      if (quest.childId !== session.childId) {
        return err("forbidden", "Access denied");
      }

      const allCompleted = quest.missions.every((m) => m.status === "completed");
      if (!allCompleted) {
        return err(
          "incomplete_quest",
          "All 7 missions must be completed before quest completion.",
        );
      }

      const detectedTalents = quest.discovery?.detectedTalents
        ? safeParseJSON<Array<{ name: string; confidence: number }>>(
            quest.discovery.detectedTalents,
            [],
          )
        : [];

      // Sanitize URL input unconditionally (XSS prevention + URL origin check)
      if ("selectedPhotoUrl" in data && data.selectedPhotoUrl) {
        const sanitized = sanitizeInput(data.selectedPhotoUrl);
        if (!isAllowedStorageUrl(sanitized)) {
          return err("invalid", "Invalid photo URL origin");
        }
        (data as { selectedPhotoUrl: string }).selectedPhotoUrl = sanitized;
      }

      // Handle skip gallery — still marks quest completed and ingests signals
      if ("skipGallery" in data && data.skipGallery) {
        await db.update(quests).set({ status: "completed" }).where(eq(quests.id, questId));
        await runQuestCompletedSignals({
          childId: session.childId,
          questId,
          dream: quest.dream,
          localContext: quest.localContext,
          detectedTalents,
        });
        return ok({ success: true as const, galleryEntry: null, skipped: true as const });
      }

      const selectedPhotoUrl =
        "selectedPhotoUrl" in data ? data.selectedPhotoUrl : undefined;

      if (selectedPhotoUrl) {
        const validPhotoUrls = quest.missions
          .filter((m) => m.proofPhotoUrl)
          .map((m) => m.proofPhotoUrl);

        if (!validPhotoUrls.includes(selectedPhotoUrl)) {
          return err(
            "invalid_photo",
            "Selected photo must be from one of the quest's completed missions.",
          );
        }
      }

      // Check for duplicate gallery entry
      const existingEntry = await db.query.galleryEntries.findFirst({
        where: eq(galleryEntries.questId, questId),
      });

      if (existingEntry) {
        return err("duplicate_entry", "A gallery entry already exists for this quest.");
      }

      const sortedTalents = [...detectedTalents].sort(
        (a, b) => (b.confidence ?? 0) - (a.confidence ?? 0),
      );
      const talentCategory = sortedTalents[0]?.name ?? "Creative";

      const geoResult = geocodeLocationText(quest.localContext);
      const country = geoResult?.country ?? null;
      const coordinates = geoResult?.coordinates ? JSON.stringify(geoResult.coordinates) : null;

      const questContext = JSON.stringify({
        questTitle: quest.dream,
        dream: quest.dream,
        missionSummaries: quest.missions.map((m) => m.title),
      });

      const galleryEntry = await db.transaction(async (tx) => {
        const [entry] = await tx
          .insert(galleryEntries)
          .values({
            childId: session.childId,
            questId,
            imageUrl: selectedPhotoUrl!,
            talentCategory,
            country,
            coordinates,
            questContext,
          })
          .returning();

        await tx.update(quests).set({ status: "completed" }).where(eq(quests.id, questId));

        return entry;
      });

      // Ingest quest-completed interest signals (fire-and-forget)
      await runQuestCompletedSignals({
        childId: session.childId,
        questId,
        dream: quest.dream,
        localContext: quest.localContext,
        detectedTalents,
      });

      type QuestContextShape = {
        questTitle: string;
        dream: string;
        missionSummaries: string[];
      };

      const parsedQuestContext = safeParseJSON<QuestContextShape | null>(
        galleryEntry.questContext,
        null,
      );
      const strippedQuestContext = stripLocalContext(parsedQuestContext) as QuestContextShape | null;

      return ok({
        success: true as const,
        galleryEntry: {
          id: galleryEntry.id,
          imageUrl: galleryEntry.imageUrl,
          talentCategory: galleryEntry.talentCategory,
          country: galleryEntry.country,
          coordinates: safeParseJSON<{ lat: number; lng: number } | null>(
            galleryEntry.coordinates,
            null,
          ),
          questContext: strippedQuestContext,
        },
      });
    } catch (error) {
      console.error("Quest completion error:", error);
      return err("server_error", "Failed to complete quest");
    }
  });
