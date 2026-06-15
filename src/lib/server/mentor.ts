import { createServerFn } from "@tanstack/react-start";
import { eq, asc, desc, sql, and } from "drizzle-orm";
import { z } from "zod";

import { getChildSession } from "@/lib/auth-start";
import { db } from "@/lib/db";
import {
  mentorSessions,
  mentorMessages,
  adjustmentEvents,
  missions,
  children,
  quests,
  reflectionEntries,
} from "@/lib/schema";
import { sanitizeInput } from "@/lib/sanitize";
import { isAllowedStorageUrl } from "@/lib/url-allowlist";
import {
  CreateSessionInputSchema,
  SendMessageInputSchema,
  AdjustmentInputSchema,
  ReflectionInputSchema,
} from "@/lib/ai/mentor-schemas";
import {
  mentorChat,
  detectFrustration,
  resolveCheckinAction,
  applyCheckinOverride,
  simplifyMission,
  summarizeReflection,
} from "@/lib/ai/mentor";
import { buildBadgeContext, evaluateBadges, awardBadges } from "@/lib/badges";
import { getAgeGroup } from "@/lib/age";
import { recordZpdEvent, getZpdScore, scoreToBand } from "@/lib/zpd";
import { ok, err } from "@/lib/server/result";

// ---------------------------------------------------------------------------
// getMentorSessionFn
// GET /api/mentor/session?missionId=xxx  (fetch-or-create)
// ---------------------------------------------------------------------------

const GetMentorSessionInputSchema = z.object({ missionId: z.string() });

export const getMentorSessionFn = createServerFn({ method: "GET" })
  .validator((d: unknown) => GetMentorSessionInputSchema.parse(d))
  .handler(async ({ data }) => {
    const session = await getChildSession();
    if (!session) return err("unauthorized", "Authentication required");

    const { missionId } = data;

    let mentorSession = await db.query.mentorSessions.findFirst({
      where: eq(mentorSessions.missionId, missionId),
      with: {
        messages: { orderBy: asc(mentorMessages.createdAt) },
        adjustments: { orderBy: desc(adjustmentEvents.createdAt) },
      },
    });

    if (!mentorSession) {
      // Auto-create if mission is in_progress and belongs to this child
      const mission = await db.query.missions.findFirst({
        where: eq(missions.id, missionId),
        with: { quest: true },
      });

      if (!mission || mission.quest.childId !== session.childId) {
        return err("not_found", "Mission not found");
      }

      if (mission.status !== "in_progress") {
        return err("invalid_state", "Mission must be in progress to start mentor chat");
      }

      await db.insert(mentorSessions).values({
        missionId,
        childId: session.childId,
        questId: mission.questId,
        status: "active",
      });

      mentorSession = await db.query.mentorSessions.findFirst({
        where: eq(mentorSessions.missionId, missionId),
        with: {
          messages: { orderBy: asc(mentorMessages.createdAt) },
          adjustments: { orderBy: desc(adjustmentEvents.createdAt) },
        },
      });
    }

    if (!mentorSession) {
      return err("server_error", "Failed to fetch mentor session");
    }

    if (mentorSession.childId !== session.childId) {
      return err("forbidden", "Access denied");
    }

    return ok({
      sessionId: mentorSession.id,
      messages: mentorSession.messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        meta: m.meta ? JSON.parse(m.meta) : null,
        createdAt: m.createdAt.toISOString(),
      })),
    });
  });

// ---------------------------------------------------------------------------
// createMentorSessionFn
// POST /api/mentor/session  (explicit create)
// ---------------------------------------------------------------------------

export const createMentorSessionFn = createServerFn({ method: "POST" })
  .validator((d: unknown) => CreateSessionInputSchema.parse(d))
  .handler(async ({ data }) => {
    const session = await getChildSession();
    if (!session) return err("unauthorized", "Authentication required");

    const { questId, missionId } = data;

    const mission = await db.query.missions.findFirst({
      where: eq(missions.id, missionId),
      with: { quest: true },
    });

    if (!mission || mission.quest.id !== questId || mission.quest.childId !== session.childId) {
      return err("not_found", "Mission not found");
    }

    const existing = await db.query.mentorSessions.findFirst({
      where: eq(mentorSessions.missionId, missionId),
    });

    if (existing) {
      return err("exists", "Session already exists for this mission");
    }

    const mentorSession = (
      await db
        .insert(mentorSessions)
        .values({
          missionId,
          childId: session.childId,
          questId,
          status: "active",
        })
        .returning()
    )[0];

    return ok({
      id: mentorSession.id,
      missionId: mentorSession.missionId,
      status: mentorSession.status,
      createdAt: mentorSession.createdAt.toISOString(),
    });
  });

// ---------------------------------------------------------------------------
// sendMentorMessageFn
// POST /api/mentor/message
// ---------------------------------------------------------------------------

export const sendMentorMessageFn = createServerFn({ method: "POST" })
  .validator((d: unknown) => {
    // Allow empty content for greeting requests (mirrors the route's pre-parse patch)
    const raw = d as Record<string, unknown>;
    if (raw.content === null || raw.content === undefined) raw.content = "";
    return SendMessageInputSchema.parse(raw);
  })
  .handler(async ({ data }) => {
    const session = await getChildSession();
    if (!session) return err("unauthorized", "Authentication required");

    const { sessionId, content, behavioralSignals } = data;
    const isGreeting = content === "";
    const sanitizedContent = isGreeting ? "" : sanitizeInput(content);

    const mentorSession = await db.query.mentorSessions.findFirst({
      where: eq(mentorSessions.id, sessionId),
      with: {
        messages: { orderBy: asc(mentorMessages.createdAt) },
        adjustments: true,
      },
    });

    if (!mentorSession) return err("not_found", "Session not found");
    if (mentorSession.childId !== session.childId) return err("forbidden", "Access denied");
    if (mentorSession.status !== "active") return err("invalid_state", "Session is no longer active");

    const mission = await db.query.missions.findFirst({
      where: eq(missions.id, mentorSession.missionId),
    });

    if (!mission) return err("not_found", "Mission not found");

    const instructions: string[] = (() => {
      try { return JSON.parse(mission.instructions); } catch { return []; }
    })();
    const materials: string[] = (() => {
      try { return JSON.parse(mission.materials); } catch { return []; }
    })();

    const activeAdjustment = mentorSession.adjustments[0];
    const activeInstructions = activeAdjustment
      ? (() => { try { return JSON.parse(activeAdjustment.simplifiedInstructions); } catch { return instructions; } })()
      : instructions;

    if (!isGreeting) {
      await db.insert(mentorMessages).values({
        sessionId,
        role: "child",
        content: sanitizedContent,
      });
    }

    const child = await db.query.children.findFirst({
      where: eq(children.id, mentorSession.childId),
      columns: { dateOfBirth: true },
    });
    const { band: ageGroup } = getAgeGroup(child?.dateOfBirth);

    const childMessages = mentorSession.messages
      .filter((m) => m.role === "child")
      .map((m) => m.content)
      .concat(isGreeting ? [] : [sanitizedContent]);

    const sessionDurationMinutes = (Date.now() - mentorSession.createdAt.getTime()) / 60_000;

    const inactivityMinutes = behavioralSignals?.lastInputAt
      ? (Date.now() - new Date(behavioralSignals.lastInputAt).getTime()) / 60_000
      : undefined;

    const frustrationLevel = detectFrustration(
      {
        messageCount: mentorSession.messages.length + (isGreeting ? 0 : 1),
        childMessageCount: childMessages.length,
        sessionDurationMinutes,
        recentChildMessages: childMessages.slice(-5),
        inactivityMinutes,
        editEvents: behavioralSignals?.editEvents,
        voiceProsody: behavioralSignals?.voiceProsody,
        pendingCheckin: mentorSession.checkinPending,
      },
      ageGroup,
    );

    const checkinAction = resolveCheckinAction(frustrationLevel, mentorSession.checkinPending);
    const mentorFrustrationLevel = applyCheckinOverride(frustrationLevel, checkinAction);

    const chatHistory = mentorSession.messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30_000);
    let mentorResponse;
    try {
      mentorResponse = await mentorChat(
        isGreeting ? null : sanitizedContent,
        mentorFrustrationLevel,
        {
          day: mission.day,
          title: mission.title,
          description: mission.description,
          instructions: activeInstructions,
          materials,
        },
        chatHistory,
        isGreeting,
        ageGroup,
      );
    } finally {
      clearTimeout(timeoutId);
    }

    if (checkinAction === "checkin") {
      await db
        .update(mentorSessions)
        .set({ checkinPending: true })
        .where(eq(mentorSessions.id, sessionId));
    } else if (checkinAction === "adjustment" || checkinAction === null) {
      if (mentorSession.checkinPending) {
        await db
          .update(mentorSessions)
          .set({ checkinPending: false })
          .where(eq(mentorSessions.id, sessionId));
      }
    }

    if (checkinAction === "adjustment") {
      try {
        await recordZpdEvent({
          childId: session.childId,
          outcome: "frustration_sustained",
          missionId: mentorSession.missionId,
        });
      } catch (zpdError) {
        console.error("ZPD event recording failed for sustained frustration, continuing:", zpdError);
      }
    }

    const savedMentorMessage = (
      await db
        .insert(mentorMessages)
        .values({
          sessionId,
          role: "mentor",
          content: mentorResponse.message,
          meta: JSON.stringify({
            suggestions: mentorResponse.suggestions,
            frustrationLevel: mentorResponse.frustrationLevel ?? frustrationLevel,
            offerAdjustment: mentorResponse.offerAdjustment,
          }),
        })
        .returning()
    )[0];

    // Check for trailblazer badge (first mentor chat usage)
    const badgeCtx = await buildBadgeContext({
      childId: session.childId,
      questId: mentorSession.questId,
    });
    const newBadgeSlugs = evaluateBadges(badgeCtx);
    const newBadges = await awardBadges({
      childId: session.childId,
      newlyEarnedSlugs: newBadgeSlugs,
      trigger: "mentor_message",
      questId: mentorSession.questId,
    });

    return ok({
      message: {
        id: savedMentorMessage.id,
        role: "mentor" as const,
        content: mentorResponse.message,
        suggestions: mentorResponse.suggestions,
        frustrationLevel: mentorResponse.frustrationLevel ?? frustrationLevel,
        offerAdjustment: mentorResponse.offerAdjustment,
        createdAt: savedMentorMessage.createdAt.toISOString(),
      },
      newBadges: newBadges.length > 0 ? newBadges : undefined,
    });
  });

// ---------------------------------------------------------------------------
// adjustMentorFn
// POST /api/mentor/adjust
// ---------------------------------------------------------------------------

export const adjustMentorFn = createServerFn({ method: "POST" })
  .validator((d: unknown) => AdjustmentInputSchema.parse(d))
  .handler(async ({ data }) => {
    const session = await getChildSession();
    if (!session) return err("unauthorized", "Authentication required");

    const { sessionId, reason } = data;

    const mentorSession = await db.query.mentorSessions.findFirst({
      where: eq(mentorSessions.id, sessionId),
    });

    if (!mentorSession) return err("not_found", "Session not found");
    if (mentorSession.childId !== session.childId) return err("forbidden", "Access denied");

    // Limit adjustments per session (max 3)
    if (mentorSession.adjustmentCount >= 3) {
      return err("limit_reached", "Maximum adjustments reached for this mission");
    }

    const mission = await db.query.missions.findFirst({
      where: eq(missions.id, mentorSession.missionId),
    });

    if (!mission) return err("not_found", "Mission not found");

    const originalInstructions: string[] = (() => {
      try { return JSON.parse(mission.instructions); } catch { return []; }
    })();
    const materials: string[] = (() => {
      try { return JSON.parse(mission.materials); } catch { return []; }
    })();

    // Derive ZPD floor band for this child so the simplification stays in-band
    const currentZpdScore = await getZpdScore(session.childId);
    const currentBand = scoreToBand(currentZpdScore);

    const simplified = await simplifyMission(
      originalInstructions,
      mission.title,
      materials,
      currentBand,
    );

    const result = await db.transaction(async (tx) => {
      const adjustment = (
        await tx
          .insert(adjustmentEvents)
          .values({
            sessionId,
            missionId: mentorSession.missionId,
            originalInstructions: JSON.stringify(originalInstructions),
            simplifiedInstructions: JSON.stringify(simplified.simplifiedInstructions),
            reason,
          })
          .returning()
      )[0];

      await tx
        .update(mentorSessions)
        .set({ adjustmentCount: sql`${mentorSessions.adjustmentCount} + 1` })
        .where(eq(mentorSessions.id, sessionId));

      return adjustment;
    });

    await db.insert(mentorMessages).values({
      sessionId,
      role: "mentor",
      content: simplified.encouragementMessage,
      meta: JSON.stringify({
        type: "adjustment",
        adjustmentId: result.id,
      }),
    });

    // Check for creativity badges (creative_adapter, persistent_explorer)
    const badgeCtx = await buildBadgeContext({
      childId: session.childId,
      questId: mentorSession.questId,
    });
    const newBadgeSlugs = evaluateBadges(badgeCtx);
    const newBadges = await awardBadges({
      childId: session.childId,
      newlyEarnedSlugs: newBadgeSlugs,
      trigger: "adjustment",
      questId: mentorSession.questId,
    });

    return ok({
      id: result.id,
      simplifiedInstructions: simplified.simplifiedInstructions,
      encouragementMessage: simplified.encouragementMessage,
      reason,
      createdAt: result.createdAt.toISOString(),
      newBadges: newBadges.length > 0 ? newBadges : undefined,
    });
  });

// ---------------------------------------------------------------------------
// submitReflectionFn
// POST /api/reflection/daily
// ---------------------------------------------------------------------------

export const submitReflectionFn = createServerFn({ method: "POST" })
  .validator((d: unknown) => ReflectionInputSchema.parse(d))
  .handler(async ({ data }) => {
    const session = await getChildSession();
    if (!session) return err("unauthorized", "Authentication required");

    const { questId, missionDay, type, content, fileUrl } = data;

    const quest = await db.query.quests.findFirst({
      where: eq(quests.id, questId),
    });

    if (!quest || quest.childId !== session.childId) {
      return err("not_found", "Quest not found");
    }

    const sanitizedContent = sanitizeInput(content);
    let sanitizedFileUrl: string | undefined;

    if (fileUrl) {
      sanitizedFileUrl = sanitizeInput(fileUrl);
      if (!isAllowedStorageUrl(sanitizedFileUrl)) {
        return err("invalid", "Invalid file URL");
      }
    }

    // 409 already-submitted -> err('already_exists', ...)
    const existing = await db.query.reflectionEntries.findFirst({
      where: and(
        eq(reflectionEntries.childId, session.childId),
        eq(reflectionEntries.questId, questId),
        eq(reflectionEntries.missionDay, missionDay),
      ),
    });

    if (existing) {
      return err("already_exists", "Reflection already exists for this mission day");
    }

    const mission = await db.query.missions.findFirst({
      where: and(eq(missions.questId, questId), eq(missions.day, missionDay)),
    });

    const missionTitle = mission?.title ?? `Day ${missionDay}`;

    const aiSummary = await summarizeReflection(
      sanitizedContent,
      missionDay,
      missionTitle,
    );

    const _reflection = (
      await db
        .insert(reflectionEntries)
        .values({
          childId: session.childId,
          questId,
          missionDay,
          type,
          content: sanitizedContent,
          fileUrl: sanitizedFileUrl,
          // COPPA: voice recordings are biometric data — enforce 365-day TTL
          fileExpiresAt: sanitizedFileUrl ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) : null,
          aiSummary: JSON.stringify(aiSummary),
        })
        .returning()
    )[0];

    const badgeCtx = await buildBadgeContext({
      childId: session.childId,
      questId,
    });
    const newBadgeSlugs = evaluateBadges(badgeCtx);
    const newBadges = await awardBadges({
      childId: session.childId,
      newlyEarnedSlugs: newBadgeSlugs,
      trigger: "reflection",
      questId,
    });

    // Record ZPD event — reflecting on a mission is a strong engagement signal
    try {
      await recordZpdEvent({
        childId: session.childId,
        outcome: "completion_strong_reflection",
        missionId: mission?.id ?? null,
      });
    } catch (zpdError) {
      console.error("ZPD event recording failed for reflection, continuing:", zpdError);
    }

    return ok({
      aiSummary,
      newBadges: newBadges.length > 0 ? newBadges : undefined,
    });
  });
