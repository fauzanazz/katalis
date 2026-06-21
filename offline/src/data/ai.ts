import type { Locale } from "@/paraglide/runtime";
import type { MentorMessage } from "./types";

/**
 * Client-side AI via Google Gemini (OpenAI-compatible endpoint).
 *
 * With no backend, the app calls Gemini directly from the device when online.
 * The key is injected at build time (VITE_GEMINI_API_KEY) and ships inside the
 * APK — it IS extractable, so scope it to a usage-capped key. When the key is
 * absent or the device is offline, callers fall back to a scripted experience
 * so every screen still works.
 *
 * Powers four features, all degrading gracefully offline:
 *  - {@link mentorReply}      — Kit chat
 *  - {@link analyzeArtwork}   — Talent Scout (Explore): detect talents from a drawing
 *  - {@link artworkFeedback}  — Gallery: warm, specific feedback on a saved creation
 *  - {@link missionTip}       — Quest: a personalized tip for today's mission
 *
 * NOTE: generativelanguage.googleapis.com is GFW-blocked in mainland China, so
 * the live features only work outside the firewall (or via a proxy). The bundled
 * offline experience (quests/missions/badges/gallery + scripted fallbacks) needs
 * no network and works in China regardless.
 */
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
const MODEL = (import.meta.env.VITE_GEMINI_MODEL as string | undefined) ?? "gemini-2.5-flash";
const BASE_URL =
  (import.meta.env.VITE_GEMINI_BASE_URL as string | undefined) ??
  "https://generativelanguage.googleapis.com/v1beta/openai";

/** True when an AI key is configured AND the device currently has a connection. */
export function aiReachable(): boolean {
  return Boolean(API_KEY) && (typeof navigator === "undefined" || navigator.onLine);
}

/** Human-readable language name injected into prompts so Kit replies in the child's language. */
const LANGUAGE_NAME: Record<Locale, string> = {
  id: "Bahasa Indonesia",
  en: "English",
  zh: "Simplified Chinese (简体中文)",
};

// ── Low-level Gemini chat ────────────────────────────────────────────────────

type TextPart = { type: "text"; text: string };
type ImagePart = { type: "image_url"; image_url: { url: string } };
type ContentPart = TextPart | ImagePart;
interface ChatTurn {
  role: "system" | "user" | "assistant";
  content: string | ContentPart[];
}

/**
 * One call to Gemini's OpenAI-compatible chat endpoint. Throws on no-key /
 * offline / API error so callers can fall back to a scripted experience.
 */
async function chat(
  messages: ChatTurn[],
  opts: { maxTokens?: number; temperature?: number; signal?: AbortSignal } = {},
): Promise<string> {
  if (!API_KEY) throw new Error("AI not configured");

  const response = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      temperature: opts.temperature ?? 0.7,
      max_tokens: opts.maxTokens ?? 400,
      // Gemini 2.5 models "think" by default, and those reasoning tokens are
      // drawn from max_tokens — large/structured replies get truncated
      // (finish_reason "length") before any visible JSON. Disable thinking for
      // fast, complete, cheap replies suited to a children's app.
      reasoning_effort: "none",
    }),
    signal: opts.signal,
  });

  if (!response.ok) throw new Error(`Gemini ${response.status}`);
  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) throw new Error("Empty AI response");
  return content.trim();
}

/** Pull a JSON value out of a model reply, tolerating ```json fences and stray prose. */
function parseJson<T>(raw: string): T {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1] : raw;
  const start = body.search(/[{[]/);
  const end = Math.max(body.lastIndexOf("}"), body.lastIndexOf("]"));
  const slice = start >= 0 && end > start ? body.slice(start, end + 1) : body;
  return JSON.parse(slice) as T;
}

const clamp01 = (n: number): number => Math.max(0, Math.min(1, n));
const asText = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

// ── Mentor chat ──────────────────────────────────────────────────────────────

const SYSTEM_PROMPT: Record<Locale, string> = {
  id: "Kamu Kit, mentor yang hangat dan ceria untuk anak usia 6-12 tahun. Bicara sederhana, positif, dan menyemangati. Jawaban singkat (2-4 kalimat), aman untuk anak, tanpa topik dewasa. Dorong rasa ingin tahu dan ketekunan. Selalu balas dalam Bahasa Indonesia.",
  en: "You are Kit, a warm and cheerful mentor for children aged 6-12. Speak simply, positively, and encouragingly. Keep replies short (2-4 sentences), child-safe, and free of adult topics. Nurture curiosity and persistence. Always reply in English.",
  zh: "你是 Kit，一位温暖开朗的儿童导师，面向 6 至 12 岁的孩子。用简单、积极、鼓励的语气交流。回答简短（2-4 句），适合儿童，不涉及成人话题。培养好奇心和坚持力。始终用中文回复。",
};

/**
 * Ask the mentor for a reply. Throws on no-key / offline / API error so the
 * caller can fall back to {@link scriptedReply}.
 */
export async function mentorReply(
  history: MentorMessage[],
  opts: { locale: Locale; childName: string; questTitle?: string; signal?: AbortSignal },
): Promise<string> {
  const context =
    ` Anak bernama ${opts.childName}.` +
    (opts.questTitle ? ` Sedang mengerjakan petualangan "${opts.questTitle}".` : "");

  return chat(
    [
      { role: "system", content: SYSTEM_PROMPT[opts.locale] + context },
      ...history.map((m) => ({ role: m.role, content: m.content })),
    ],
    { temperature: 0.8, maxTokens: 400, signal: opts.signal },
  );
}

// ── Talent Scout: detect talents from a child's drawing (Explore) ─────────────

export interface ArtworkTalent {
  /** Specific, child-facing name (localized), never generic like "creativity". */
  name: string;
  /** Kit's confidence, 0..1. */
  confidence: number;
  /** Short, kid-friendly reason describing what Kit saw (localized). */
  reason: string;
}

export interface ArtworkAnalysis {
  talents: ArtworkTalent[];
  /** One cheerful sentence for the child (localized). */
  encouragement: string;
  /** Bundled quest ids Kit recommends, validated against the supplied catalog. */
  recommendedQuestIds: string[];
}

/** Minimal quest descriptor passed to the scout so its recommendations stay grounded. */
export interface QuestCatalogEntry {
  id: string;
  /** English talent label, e.g. "Engineering". */
  talent: string;
  /** Theme slug, e.g. "engineering". */
  theme: string;
}

/**
 * Multimodal analysis of a child's artwork → detected talents + encouragement +
 * recommended bundled quests. `imageDataUrl` should be a downscaled JPEG/PNG
 * data URL (see {@link downscaleDataUrl}). Throws so the caller can show a
 * graceful offline/error state.
 */
export async function analyzeArtwork(
  imageDataUrl: string,
  opts: { locale: Locale; childName: string; catalog: QuestCatalogEntry[]; signal?: AbortSignal },
): Promise<ArtworkAnalysis> {
  const catalogLines = opts.catalog.map((q) => `- ${q.id}: ${q.talent} (${q.theme})`).join("\n");

  const system = `You are Kit, a warm, expert talent scout for children aged 6-12. A child named ${opts.childName} shows you a drawing or creation.

Look BEYOND surface labels — analyze WHAT the child focused on and WHY it reveals a specific interest or talent (detailed robot joints → Engineering; balanced colours → Visual Art; characters with feelings → Storytelling).

Detect 2-3 talents. For each give a specific name (never generic like "creativity"), a confidence from 0.0 to 1.0, and a short kid-friendly reason describing what you actually see.

Then pick 1-2 best-matching adventures for this child from this catalog (use the EXACT ids):
${catalogLines}

Write every child-facing field (each talent "name" and "reason", and "encouragement") in ${LANGUAGE_NAME[opts.locale]}, warm and simple. "recommendedQuestIds" must only contain ids from the catalog above.

Respond ONLY with valid JSON in this exact shape:
{"talents":[{"name":"...","confidence":0.0,"reason":"..."}],"encouragement":"one cheerful sentence for the child","recommendedQuestIds":["id"]}`;

  const raw = await chat(
    [
      { role: "system", content: system },
      {
        role: "user",
        content: [
          { type: "text", text: "Here is my creation! What are my talents?" },
          { type: "image_url", image_url: { url: imageDataUrl } },
        ],
      },
    ],
    { temperature: 0.6, maxTokens: 800, signal: opts.signal },
  );

  const parsed = parseJson<{
    talents?: Array<{ name?: unknown; confidence?: unknown; reason?: unknown }>;
    encouragement?: unknown;
    recommendedQuestIds?: unknown;
  }>(raw);

  const talents: ArtworkTalent[] = Array.isArray(parsed.talents)
    ? parsed.talents
        .filter((entry) => asText(entry?.name))
        .map((entry) => ({
          name: asText(entry.name),
          confidence: clamp01(typeof entry.confidence === "number" ? entry.confidence : 0.7),
          reason: asText(entry.reason),
        }))
    : [];
  if (talents.length === 0) throw new Error("No talents detected");

  const validIds = new Set(opts.catalog.map((q) => q.id));
  const recommendedQuestIds = Array.isArray(parsed.recommendedQuestIds)
    ? parsed.recommendedQuestIds.filter((id): id is string => typeof id === "string" && validIds.has(id))
    : [];

  return { talents, encouragement: asText(parsed.encouragement), recommendedQuestIds };
}

// ── Gallery: warm, specific feedback on a saved creation ──────────────────────

export interface ArtworkFeedback {
  /** What's wonderful (1 sentence, localized). */
  praise: string;
  /** One real talent Kit sees (1 sentence, localized). */
  noticed: string;
  /** One gentle, doable idea to try next (1 sentence, localized). */
  tryNext: string;
}

/**
 * Friendly mentor feedback on a child's saved artwork. `imageDataUrl` should be
 * a downscaled data URL. Throws so the caller can fall back gracefully.
 */
export async function artworkFeedback(
  imageDataUrl: string,
  opts: { locale: Locale; childName: string; caption?: string; signal?: AbortSignal },
): Promise<ArtworkFeedback> {
  const captionLine = opts.caption?.trim() ? ` The child titled it "${opts.caption.trim()}".` : "";

  const system = `You are Kit, a warm mentor for a child aged 6-12 named ${opts.childName}. The child shows you a creation they made.${captionLine}

Give kind, SPECIFIC, encouraging feedback. Praise one real thing, name one talent you genuinely see, and offer one gentle, doable idea to try next. Keep each to a single short sentence, joyful and age-appropriate.

Write everything in ${LANGUAGE_NAME[opts.locale]}.

Respond ONLY with valid JSON in this exact shape:
{"praise":"...","noticed":"...","tryNext":"..."}`;

  const raw = await chat(
    [
      { role: "system", content: system },
      {
        role: "user",
        content: [
          { type: "text", text: "Here is my creation. What do you think?" },
          { type: "image_url", image_url: { url: imageDataUrl } },
        ],
      },
    ],
    { temperature: 0.7, maxTokens: 400, signal: opts.signal },
  );

  const parsed = parseJson<{ praise?: unknown; noticed?: unknown; tryNext?: unknown }>(raw);
  const feedback: ArtworkFeedback = {
    praise: asText(parsed.praise),
    noticed: asText(parsed.noticed),
    tryNext: asText(parsed.tryNext),
  };
  if (!feedback.praise && !feedback.noticed && !feedback.tryNext) throw new Error("Empty feedback");
  return feedback;
}

// ── Quest: a personalized tip for today's mission ─────────────────────────────

/**
 * One short, personalized tip for the child's current mission. Throws so the
 * caller can fall back to {@link scriptedReply}.
 */
export async function missionTip(opts: {
  locale: Locale;
  childName: string;
  questTitle: string;
  missionTitle: string;
  instructions: string[];
  signal?: AbortSignal;
}): Promise<string> {
  const system = `You are Kit, a warm, encouraging mentor for a child aged 6-12. Give ONE short, specific, doable tip for today's mission, tailored to the child. Be cheerful and concrete — at most 2 sentences. Write in ${LANGUAGE_NAME[opts.locale]}.`;
  const user = `Child: ${opts.childName}. Adventure: "${opts.questTitle}". Today's mission: "${opts.missionTitle}". Steps: ${opts.instructions.join("; ")}. Give one encouraging tip just for ${opts.childName}.`;

  return chat(
    [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    { temperature: 0.85, maxTokens: 160, signal: opts.signal },
  );
}

// ── Offline / no-key fallback ─────────────────────────────────────────────────

const FALLBACK_REPLIES: Record<Locale, string[]> = {
  id: [
    "Hebat! Teruskan ya, kamu pasti bisa. Coba satu langkah kecil dulu.",
    "Wah, ide bagus! Apa hal pertama yang ingin kamu coba hari ini?",
    "Jangan menyerah ya. Setiap pencipta hebat memulai dari mencoba!",
    "Aku bangga padamu! Ceritakan apa yang sudah kamu buat.",
  ],
  en: [
    "Awesome! Keep going — you can do it. Try one small step first.",
    "What a great idea! What's the first thing you want to try today?",
    "Don't give up. Every great maker starts by trying!",
    "I'm proud of you! Tell me what you've made so far.",
  ],
  zh: [
    "太棒了！继续加油，你一定可以的。先试一小步吧。",
    "好主意！今天你想先尝试什么呢？",
    "别放弃哦，每个了不起的创造者都是从尝试开始的！",
    "我为你感到骄傲！告诉我你已经做了什么吧。",
  ],
};

/** Offline / no-key fallback: a friendly canned encouragement. */
export function scriptedReply(locale: Locale): string {
  const pool = FALLBACK_REPLIES[locale];
  return pool[Math.floor(Math.random() * pool.length)];
}
