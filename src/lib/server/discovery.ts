import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { z } from "zod";
import { eq, desc, count } from "drizzle-orm";

import { getChildSession } from "@/lib/auth-start";
import { db } from "@/lib/db";
import { children, discoveries } from "@/lib/schema";
import { ok, err } from "@/lib/server/result";
import { getClientIp } from "@/lib/request-ip";
import { checkRateLimit } from "@/lib/rate-limit";
import { sanitizeInput } from "@/lib/sanitize";
import { isAllowedStorageUrl } from "@/lib/url-allowlist";
import { AnalysisInputSchema } from "@/lib/ai/schemas";
import { StoryAnalysisInputSchema } from "@/lib/ai/story-schemas";
import { analyzeArtifact, analyzeStory } from "@/lib/ai/client";
import { moderateImageContent, moderateContent, getUncertaintyFallback } from "@/lib/moderation";
import { bandForDob, isModalityAllowed, modalityFromArtifactType } from "@/lib/discover/age-modality";
import { KidsArtBenchScoreSchema, mapToGardner } from "@/lib/ai/kidsartbench-schemas";
import { mapDiscoveryAnalysisToInterestSignals } from "@/lib/interests/discovery-mapper";
import { ingestInterestSignals } from "@/lib/interests/ingest-service";
import { recordZpdEvent } from "@/lib/zpd/service";
import { upsertGardnerScores } from "@/lib/interests/gardner-service";
import type { Talent } from "@/lib/ai/schemas";

const GUEST_ANALYZE_LIMIT = 2;
const GUEST_ANALYZE_WINDOW_MS = 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// analyzeArtifactFn
// ---------------------------------------------------------------------------

export const analyzeArtifactFn = createServerFn({ method: "POST" })
  .validator((d: unknown) => AnalysisInputSchema.parse(d))
  .handler(async ({ data }) => {
    const session = await getChildSession();

    if (!session?.childId) {
      const ip = getClientIp(new Headers(getRequestHeaders())) ?? "unknown";
      const rl = await checkRateLimit(`analyze:${ip}`, "guest-analyze", {
        maxAttempts: GUEST_ANALYZE_LIMIT,
        windowMs: GUEST_ANALYZE_WINDOW_MS,
      });
      if (rl.limited) {
        return err(
          "guest_limit_reached",
          "Guest analysis limit reached. Create a free account to keep discovering!",
        );
      }
    }

    const sanitizedUrl = sanitizeInput(data.artifactUrl);
    if (!isAllowedStorageUrl(sanitizedUrl)) {
      return err("invalid", "Invalid artifact URL");
    }

    const patchedData = { ...data, artifactUrl: sanitizedUrl };

    let dob: Date | null | undefined;
    if (session?.childId) {
      const child = await db.query.children.findFirst({
        where: eq(children.id, session.childId),
        columns: { dateOfBirth: true },
      });
      dob = child?.dateOfBirth;
    } else if (patchedData.guestDob) {
      dob = new Date(patchedData.guestDob);
    }

    const band = bandForDob(dob);
    const modality = modalityFromArtifactType(patchedData.artifactType);
    if (!isModalityAllowed(band, modality)) {
      return err(
        "modality_not_allowed_for_age",
        "This input type is not available for this child's age.",
      );
    }

    const moderationResult = await moderateImageContent({
      imageUrl: patchedData.artifactUrl,
      sourceType: "discovery",
      childId: session?.childId,
    });

    if (!moderationResult.allowed) {
      // Replicate old 403 + redirect:true body as ok() with blocked flag
      // so the client can branch identically (redirect to another page).
      return ok({
        blocked: true,
        redirect: true,
        message:
          moderationResult.redirectMessage ??
          "This content cannot be processed. Let's try something else!",
        error: "content_blocked" as const,
      });
    }

    try {
      const result = await analyzeArtifact(patchedData);

      const maxConfidence = Math.max(...result.talents.map((t) => t.confidence));
      if (maxConfidence < 0.5) {
        return ok({
          talents: result.talents,
          kidsArtBench: result.kidsArtBench,
          fallbackMessage: getUncertaintyFallback(),
          lowConfidence: true as const,
        });
      }

      return ok({ talents: result.talents, kidsArtBench: result.kidsArtBench });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error("[Analysis] Error:", msg, error);

      if (msg.includes("timed out")) {
        return err("timeout", "The analysis is taking too long. Please try again.");
      }

      return err("ai_failure", "We couldn't analyze your creation right now. Please try again!");
    }
  });

// ---------------------------------------------------------------------------
// analyzeStoryFn
// ---------------------------------------------------------------------------

export const analyzeStoryFn = createServerFn({ method: "POST" })
  .validator((d: unknown) => StoryAnalysisInputSchema.parse(d))
  .handler(async ({ data }) => {
    const session = await getChildSession();

    if (!session?.childId) {
      const ip = getClientIp(new Headers(getRequestHeaders())) ?? "unknown";
      const rl = await checkRateLimit(`analyze:${ip}`, "guest-analyze", {
        maxAttempts: GUEST_ANALYZE_LIMIT,
        windowMs: GUEST_ANALYZE_WINDOW_MS,
      });
      if (rl.limited) {
        return err(
          "guest_limit_reached",
          "Guest analysis limit reached. Create a free account to keep discovering!",
        );
      }
    }

    const patchedData = {
      ...data,
      storyText: sanitizeInput(data.storyText),
    };

    let dob: Date | null | undefined;
    if (session?.childId) {
      const child = await db.query.children.findFirst({
        where: eq(children.id, session.childId),
        columns: { dateOfBirth: true },
      });
      dob = child?.dateOfBirth;
    } else if (patchedData.guestDob) {
      dob = new Date(patchedData.guestDob);
    }

    const band = bandForDob(dob);
    const modality = patchedData.submissionType === "audio" ? "voice" : "text";
    if (!isModalityAllowed(band, modality)) {
      return err(
        "modality_not_allowed_for_age",
        "This input type is not available for this child's age.",
      );
    }

    const moderationResult = await moderateContent({
      content: patchedData.storyText,
      contentType: "text",
      sourceType: "discovery",
      childId: session?.childId,
    });

    // Preserve analyze-story's content_blocked-returns-200 quirk EXACTLY:
    // old route returned HTTP 200 with error+redirect fields in body.
    if (!moderationResult.allowed) {
      return ok({
        blocked: true,
        redirect: true,
        message:
          moderationResult.redirectMessage ??
          "This content cannot be processed. Let's try something else!",
        error: "content_blocked" as const,
      });
    }

    try {
      const result = await analyzeStory(patchedData);

      const maxConfidence = Math.max(...result.talents.map((t) => t.confidence));
      if (maxConfidence < 0.5) {
        return ok({
          talents: result.talents,
          fallbackMessage: getUncertaintyFallback(),
          lowConfidence: true as const,
        });
      }

      return ok({ talents: result.talents });
    } catch (error) {
      console.error("Story analysis error:", error);

      if (error instanceof Error && error.message.includes("timed out")) {
        return err("timeout", "The story analysis is taking too long. Please try again.");
      }

      return err("ai_failure", "We couldn't analyze your story right now. Please try again!");
    }
  });

// ---------------------------------------------------------------------------
// transcribeAudioFn
// ---------------------------------------------------------------------------

const TranscribeInputSchema = z.object({
  audioUrl: z.string().min(1, "Audio URL is required"),
});

export const transcribeAudioFn = createServerFn({ method: "POST" })
  .validator((d: unknown) => TranscribeInputSchema.parse(d))
  .handler(async ({ data }) => {
    const session = await getChildSession();

    if (!session?.childId) {
      const ip = getClientIp(new Headers(getRequestHeaders())) ?? "unknown";
      const rl = await checkRateLimit(`analyze:${ip}`, "guest-analyze", {
        maxAttempts: 2,
        windowMs: GUEST_ANALYZE_WINDOW_MS,
      });
      if (rl.limited) {
        return err("guest_limit_reached", "Guest limit reached.");
      }
    }

    if (!isAllowedStorageUrl(data.audioUrl)) {
      return err("invalid", "Invalid audio URL");
    }

    const audioRes = await fetch(data.audioUrl);
    if (!audioRes.ok) {
      return err("fetch_failed", "Could not fetch audio file");
    }

    const arrayBuffer = await audioRes.arrayBuffer();
    const rawContentType = audioRes.headers.get("content-type") ?? "audio/webm";
    // Strip codec params and normalize: Vite serves .webm as video/webm; force audio/* for Gemini
    const baseContentType = rawContentType.split(";")[0].trim();
    const contentType = baseContentType === "video/webm" ? "audio/webm"
      : baseContentType === "video/mp4" ? "audio/mp4"
      : baseContentType;

    if (process.env.OPENAI_API_KEY) {
      const audioFile = new File([arrayBuffer], "audio.webm", { type: contentType });
      const { default: OpenAI } = await import("openai");
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const transcription = await openai.audio.transcriptions.create({
        model: "whisper-1",
        file: audioFile,
      });
      return ok({ transcript: transcription.text });
    }

    if (process.env.GOOGLE_AI_API_KEY) {
      const base64Audio = Buffer.from(arrayBuffer).toString("base64");
      const model = process.env.GOOGLE_AI_MODEL ?? "gemini-2.5-flash";
      const geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GOOGLE_AI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{
              parts: [
                { inlineData: { mimeType: contentType, data: base64Audio } },
                { text: "Transcribe what is said in this audio exactly as spoken. Return only the transcription text with no commentary or labels." },
              ],
            }],
            generationConfig: { temperature: 0 },
          }),
        },
      );
      if (!geminiRes.ok) return err("ai_failure", "Transcription failed");
      const geminiJson = await geminiRes.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
      const transcript = geminiJson.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
      return ok({ transcript: transcript.trim() });
    }

    return err("no_provider", "No transcription provider configured");
  });

// ---------------------------------------------------------------------------
// saveDiscoveryFn
// ---------------------------------------------------------------------------

const SaveDiscoverySchema = z.object({
  type: z.enum(["artifact", "story"], {
    message: "Type must be 'artifact' or 'story'",
  }),
  fileUrl: z.string().optional(),
  talents: z
    .array(
      z.object({
        name: z.string().min(1),
        confidence: z.number().min(0).max(1),
        reasoning: z.string().min(1),
      }),
    )
    .min(1, "At least one talent must be provided"),
  kidsArtBench: KidsArtBenchScoreSchema.optional(),
});

export { SaveDiscoverySchema };

export const saveDiscoveryFn = createServerFn({ method: "POST" })
  .validator((d: unknown) => SaveDiscoverySchema.parse(d))
  .handler(async ({ data }) => {
    const session = await getChildSession();
    if (!session) {
      return err("unauthorized", "Authentication required");
    }

    const { type, fileUrl, talents, kidsArtBench } = data;

    const discovery = (
      await db
        .insert(discoveries)
        .values({
          childId: session.childId,
          type,
          fileUrl: fileUrl ?? null,
          aiAnalysis: JSON.stringify(
            kidsArtBench ? { talents, kidsArtBench } : { talents },
          ),
          detectedTalents: JSON.stringify(talents),
        })
        .returning()
    )[0];

    try {
      const signals = mapDiscoveryAnalysisToInterestSignals({ talents }, kidsArtBench);
      if (signals.length > 0) {
        await ingestInterestSignals({
          childId: session.childId,
          source: "discovery_analysis",
          discoveryId: discovery.id,
          signals,
        });
      }
    } catch (interestError) {
      console.error("Interest ingestion failed for discovery, continuing:", interestError);
    }

    if (kidsArtBench) {
      try {
        const dims = Object.values(kidsArtBench) as number[];
        const artComplexity = dims.reduce((sum, v) => sum + v, 0) / dims.length;
        if (artComplexity >= 0.5) {
          const outcome =
            artComplexity >= 0.7 ? "completion_strong_reflection" : "completion";
          await recordZpdEvent({ childId: session.childId, outcome });
        }
      } catch (zpdError) {
        console.error("ZPD nudge failed for artwork, continuing:", zpdError);
      }

      try {
        const gardnerScores = mapToGardner(kidsArtBench);
        await upsertGardnerScores(session.childId, gardnerScores);
      } catch (gardnerError) {
        console.error("Gardner upsert failed for artwork, continuing:", gardnerError);
      }
    }

    return ok({
      id: discovery.id,
      type: discovery.type,
      talents,
      createdAt: discovery.createdAt instanceof Date
        ? discovery.createdAt.toISOString()
        : String(discovery.createdAt),
    });
  });

// ---------------------------------------------------------------------------
// getDiscoveryHistoryFn
// ---------------------------------------------------------------------------

const DiscoveryHistoryInputSchema = z.object({
  page: z.number().int().min(1).optional().default(1),
  limit: z.number().int().min(1).max(50).optional().default(20),
});

export const getDiscoveryHistoryFn = createServerFn({ method: "GET" })
  .validator((d: unknown) => DiscoveryHistoryInputSchema.parse(d))
  .handler(async ({ data }) => {
    const session = await getChildSession();
    if (!session) {
      return err("unauthorized", "Authentication required");
    }

    const page = Math.max(1, data.page);
    const limit = Math.min(50, Math.max(1, data.limit));
    const offset = (page - 1) * limit;

    const [discoveryRows, [{ count: total }]] = await Promise.all([
      db.query.discoveries.findMany({
        where: eq(discoveries.childId, session.childId),
        orderBy: desc(discoveries.createdAt),
        limit,
        offset,
      }),
      db
        .select({ count: count() })
        .from(discoveries)
        .where(eq(discoveries.childId, session.childId)),
    ]);

    const items = discoveryRows.map((d) => {
      let talents: Talent[] = [];
      try {
        talents = JSON.parse(d.detectedTalents ?? "[]");
      } catch {
        talents = [];
      }
      return {
        id: d.id,
        type: d.type,
        fileUrl: d.fileUrl,
        talents,
        createdAt: d.createdAt instanceof Date
          ? d.createdAt.toISOString()
          : String(d.createdAt),
      };
    });

    return ok({ discoveries: items, total, page, limit });
  });

// ---------------------------------------------------------------------------
// getDiscoveryByIdFn
// ---------------------------------------------------------------------------

const DiscoveryByIdInputSchema = z.object({
  id: z.string().min(1),
});

export const getDiscoveryByIdFn = createServerFn({ method: "GET" })
  .validator((d: unknown) => DiscoveryByIdInputSchema.parse(d))
  .handler(async ({ data }) => {
    const session = await getChildSession();
    if (!session) {
      return err("unauthorized", "Authentication required");
    }

    const discovery = await db.query.discoveries.findFirst({
      where: eq(discoveries.id, data.id),
    });

    if (!discovery) {
      return err("not_found", "Discovery not found");
    }

    if (discovery.childId !== session.childId) {
      return err("forbidden", "Access denied");
    }

    let talents: Talent[] = [];
    try {
      talents = JSON.parse(discovery.detectedTalents ?? "[]");
    } catch {
      talents = [];
    }

    return ok({
      id: discovery.id,
      type: discovery.type,
      fileUrl: discovery.fileUrl,
      talents,
      createdAt: discovery.createdAt instanceof Date
        ? discovery.createdAt.toISOString()
        : String(discovery.createdAt),
    });
  });
