/**
 * Quest Buddy mentor chat — Socratic scaffolding engine.
 *
 * Uses AI providers (configurable via AI_PROVIDER) to generate question-first guidance that adapts to the
 * child's frustration level. The mentor never gives direct answers;
 * instead, it asks questions that lead the child to discover solutions.
 *
 * When frustration is detected, the mentor offers a "Small Adjustment" —
 * a simplified version of the mission that avoids failure framing.
 */

import type { AgeGroup } from "@/lib/age";

import type {
  MentorResponse,
  SimplifiedMission,
  ReflectionSummary,
  FrustrationLevel,
} from "../mentor-schemas";
import { MentorResponseSchema, SimplifiedMissionSchema, ReflectionSummarySchema } from "../mentor-schemas";
import { getMockMentorChat, getMockSimplifiedMission, getMockReflectionSummary } from "./mock-chat";
import { getMentorSystemPrompt } from "./age-config";
import { resolveModel, type ModelTier } from "../models";
import type { ZpdBand } from "@/lib/zpd";

const API_TIMEOUT_MS = 20_000;
const ANTHROPIC_BASE_MODEL = "claude-sonnet-4-20250514";
const OPENAI_BASE_MODEL = "gpt-4o";
const VERTEX_BASE_MODEL = process.env.VERTEX_AI_MODEL ?? "gemini-2.5-flash";
const GOOGLE_AI_MODEL = process.env.GOOGLE_AI_MODEL ?? "gemini-2.5-flash";

/** Context builder — assembles the conversation context for the mentor */
function buildUserMessage(
  childMessage: string | null,
  frustrationLevel: FrustrationLevel,
  missionContext: {
    day: number;
    title: string;
    description: string;
    instructions: string[];
    materials: string[];
  },
  chatHistory: Array<{ role: string; content: string }>,
  isGreeting: boolean,
  hasImage: boolean,
): string {
  const missionInfo = `[Mission Context — Day ${missionContext.day}: ${missionContext.title}]
Description: ${missionContext.description}
Instructions: ${missionContext.instructions.map((s, i) => `${i + 1}. ${s}`).join("\n")}
Materials: ${missionContext.materials.join(", ")}
Current Frustration Level: ${frustrationLevel}`;

  if (isGreeting) {
    return `${missionInfo}\n\nWrite an engaging mission kickoff message:
1. WELCOME: 1 enthusiastic sentence welcoming the child to this specific mission (mention the mission title)
2. OVERVIEW: 1-2 sentences describing what exciting thing they will create or discover today — make it sound fun and concrete
3. MATERIALS CHECK: List every required material clearly, then ask: "Do you have all of these ready, or is anything missing?"

Keep the total message to 3-5 sentences. Be warm and excited. Do NOT start the Socratic questioning yet — wait for them to confirm their materials first.`;
  }

  const recentHistory = chatHistory
    .slice(-4)
    .map((m) => `${m.role === "child" ? "Child" : "Mentor"}: ${m.content}`)
    .join("\n");

  const imageNote = hasImage
    ? "\n[The child has also shared a PHOTO of their progress. Describe specifically what you notice in the photo — their creative choices, what they built or made — and respond with enthusiasm. Focus on effort and process, not correctness.]"
    : "";

  return `${missionInfo}\n\n[Recent conversation]\n${recentHistory}\n\nChild just said: "${childMessage}"${imageNote}\n\nLook at the conversation history to determine the current phase:

PHASE 1 — MATERIALS CHECK (if the conversation is still about confirming materials):
- Child confirms ALL materials: celebrate briefly, then ask ONE Socratic spark question to start the learning
- Child mentions a MISSING material: suggest 2–3 specific household alternatives with a brief reason each works, ask if they have any
- Child proposes their OWN alternative: evaluate it ("That works because… / The issue might be…"), accept or gently redirect, then move on
- Child asks a question: answer it warmly and concisely, then return to materials check

PHASE 2 — LEARNING (once materials are confirmed, follow the 4-part structure):
1. ACKNOWLEDGE their specific answer (name exactly what they said)
2. VALIDATE if correct (explain WHY it works) OR REDIRECT if off-track (explain why a different approach would work better, give a clear hint)
3. CONNECT to the next mission step or the overall goal
4. Ask ONE question to deepen their thinking

STEP-BY-STEP GUIDANCE — this is critical:
You know the full mission instructions. Do NOT recite them directly. Guide the child to DISCOVER each step through questions and hints.

STEP TRACKING (most important rule):
- Read the conversation history and identify WHICH numbered step the child is currently on
- Once a step is sufficiently done (child has made a decision, produced something, or answered the key question for that step), MOVE ON to the next step — do NOT keep asking about the same step
- To transition: briefly celebrate the completed step, then ask what they think the NEXT physical action should be (e.g. "Great, you've got your story idea! Now, how do you think you'd organise a comic strip on paper?")
- Example progression for a comic strip mission:
  Step 1 done (story chosen) → "Now you have your story — how would you divide your paper to show each part of it?"
  Step 2 done (paper divided) → "Nice panels! Which scene do you think goes first, on the left?"
  Step 3 done (scenes drawn) → "The pictures are there — what do you think would make the characters come alive and talk?"
  Step 4 done (speech bubbles) → "Almost done! Who do you think you'd want to show this comic to first?"

- If child seems stuck on the CURRENT step after 2 exchanges: give a direct hint. After 3 exchanges on the same step: tell them the step explicitly so they can move forward.
- NEVER stay on the same step for more than 3 exchanges.

The goal: child progresses through ALL steps, discovering each one with your guidance.

Be specific — never give a generic response. Reference the mission context and what the child actually said.`;
}

/**
 * Send a message to the mentor and get a Socratic response.
 */
export async function mentorChat(
  childMessage: string | null,
  frustrationLevel: FrustrationLevel,
  missionContext: {
    day: number;
    title: string;
    description: string;
    instructions: string[];
    materials: string[];
  },
  chatHistory: Array<{ role: string; content: string }>,
  isGreeting: boolean,
  ageGroup: AgeGroup | null | undefined = "unknown",
  imageUrl?: string,
): Promise<MentorResponse> {
  if (process.env.USE_MOCK_AI === "true") {
    return getMockMentorChat(childMessage, frustrationLevel, isGreeting);
  }

  return generateMentorResponse(
    childMessage,
    frustrationLevel,
    missionContext,
    chatHistory,
    isGreeting,
    ageGroup,
    imageUrl,
  );
}

async function generateMentorResponse(
  childMessage: string | null,
  frustrationLevel: FrustrationLevel,
  missionContext: {
    day: number;
    title: string;
    description: string;
    instructions: string[];
    materials: string[];
  },
  chatHistory: Array<{ role: string; content: string }>,
  isGreeting: boolean,
  ageGroup: AgeGroup | null | undefined,
  imageUrl?: string,
): Promise<MentorResponse> {
  const userMessage = buildUserMessage(childMessage, frustrationLevel, missionContext, chatHistory, isGreeting, !!imageUrl);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    const response = await callProviderForMentor(userMessage, ageGroup, "smart", imageUrl);
    clearTimeout(timeoutId);
    return MentorResponseSchema.parse(response);
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Mentor chat timed out. Please try again.");
    }
    throw error;
  }
}

async function callOpenAICompatible(
  systemPrompt: string,
  userMessage: string,
  apiKey: string,
  baseURL: string,
  model: string,
  maxTokens: number,
): Promise<unknown> {
  const { default: OpenAI } = await import("openai");
  const client = new OpenAI({ apiKey, baseURL });
  const response = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
    max_tokens: maxTokens,
    temperature: 0.7,
  });
  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error(`Empty response from ${baseURL}`);
  console.log("[mentor] raw content length:", content.length, "preview:", JSON.stringify(content.slice(0, 120)));
  const stripped = content.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  const match = stripped.match(/\{[\s\S]*\}/) ?? [stripped];
  const sanitized = match[0].replace(/("(?:[^"\\]|\\.)*")/g, (m) =>
    m.replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/\t/g, "\\t")
  );
  return JSON.parse(sanitized);
}

// OpenRouter doesn't guarantee JSON mode on free models — strip markdown fences and extract JSON.
async function callOpenRouter(
  systemPrompt: string,
  userMessage: string,
  maxTokens: number,
  imageUrl?: string,
): Promise<unknown> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY required");
  const model = process.env.OPENROUTER_MODEL ?? "nvidia/nemotron-nano-12b-v2-vl:free";
  // Vision models (confirmed image endpoint support) — tried in order when imageUrl is present
  const visionModels = ["google/gemma-4-26b-a4b-it:free", "google/gemma-4-31b-it:free"];
  // Fallback chain — different providers to avoid shared rate limits
  const fallbackModels = [
    "openai/gpt-oss-20b:free",               // OpenAI OSS 20B — fast, good JSON
    "meta-llama/llama-3.3-70b-instruct:free", // Llama 3.3 70B — high quality backup
  ];

  const { default: OpenAI } = await import("openai");
  const client = new OpenAI({
    apiKey,
    baseURL: "https://openrouter.ai/api/v1",
    defaultHeaders: { "X-Title": "Huna AI" },
    timeout: 8_000, // 8s per-request; free models throttle silently after a few calls
  });

  // Resolve image for AI: localhost URLs are fetched and converted to base64 data URLs
  // so the external AI API can access them (localhost is unreachable from the internet).
  let resolvedImageUrl: string | undefined;
  if (imageUrl) {
    const isLocal = imageUrl.startsWith("http://localhost") || imageUrl.startsWith("http://127.0.0.1") || imageUrl.startsWith("/");
    if (isLocal) {
      const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3101";
      const fullUrl = imageUrl.startsWith("/") ? `${base}${imageUrl}` : imageUrl;
      try {
        const res = await fetch(fullUrl);
        if (res.ok) {
          const buf = await res.arrayBuffer();
          const ct = res.headers.get("content-type") ?? "image/jpeg";
          resolvedImageUrl = `data:${ct};base64,${Buffer.from(buf).toString("base64")}`;
        }
      } catch {
        // Image fetch failed — send text-only
      }
    } else {
      resolvedImageUrl = imageUrl;
    }
  }

  const userContent = resolvedImageUrl
    ? [
        { type: "text" as const, text: userMessage },
        { type: "image_url" as const, image_url: { url: resolvedImageUrl } },
      ]
    : userMessage;

  const PER_MODEL_TIMEOUT_MS = 12_000;

  const makeRequest = async (modelId: string, useJsonMode: boolean) => {
    const reqController = new AbortController();
    const reqTimeout = setTimeout(() => reqController.abort(), PER_MODEL_TIMEOUT_MS);
    let response;
    try {
      response = await client.chat.completions.create(
        {
          model: modelId,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userContent },
          ],
          ...(useJsonMode ? { response_format: { type: "json_object" as const } } : {}),
          max_tokens: maxTokens,
          temperature: 0.7,
        },
        { signal: reqController.signal },
      );
    } finally {
      clearTimeout(reqTimeout);
    }
    // choices can be undefined/empty on non-standard OpenRouter error bodies
    const raw = response.choices?.[0]?.message?.content ?? "";
    if (!raw) throw new Error("Empty response from model");
    const stripped = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    const match = stripped.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("No JSON object found in OpenRouter response");
    // Fix common model mistake: literal newlines/tabs inside JSON string values
    const sanitized = match[0].replace(/("(?:[^"\\]|\\.)*")/g, (m) =>
      m.replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/\t/g, "\\t")
    );
    return JSON.parse(sanitized);
  };

  const supportsJsonMode = (id: string) =>
    id.includes("gemma") || id.includes("gpt-oss") || id.includes("qwen3") || id.includes("nemotron-3-super");

  const isRetriable = (err: unknown) => {
    if (err instanceof SyntaxError) return true; // malformed JSON → try next model
    if (!(err instanceof Error)) return false;
    return (
      err.message.includes("429") ||
      err.message.includes("404") ||
      err.message.includes("Empty response") ||
      err.message.toLowerCase().includes("timeout") ||
      err.message.toLowerCase().includes("timed out") ||
      err.message.toLowerCase().includes("aborted") ||
      err.message.toLowerCase().includes("connection error")
    );
  };

  // When an image is attached, route to confirmed vision models first.
  // If all vision models fail, send text-only to the high-quality fallback
  // (the "[Child has shared a photo]" note in the text message is retained).
  if (resolvedImageUrl) {
    let lastErr: unknown;
    for (const visionModel of visionModels) {
      try {
        console.log(`[openrouter] trying vision model: ${visionModel}`);
        const result = await makeRequest(visionModel, supportsJsonMode(visionModel));
        console.log(`[openrouter] vision success: ${visionModel}`);
        return result;
      } catch (err) {
        console.warn(`[openrouter] vision model ${visionModel} failed:`, err instanceof Error ? err.message : err);
        lastErr = err;
        if (!isRetriable(err)) throw err;
        await new Promise((r) => setTimeout(r, 500));
      }
    }
    // All vision models failed — retry text-only through fallback chain
    console.warn("[openrouter] all vision models failed, retrying text-only:", lastErr);
    const textOnlyContent = typeof userContent === "string" ? userContent : userMessage;
    for (const fbModel of fallbackModels) {
      try {
        console.log(`[openrouter] vision text-only fallback: ${fbModel}`);
        const reqController = new AbortController();
        const reqTimeout = setTimeout(() => reqController.abort(), PER_MODEL_TIMEOUT_MS);
        let fbResponse;
        try {
          fbResponse = await client.chat.completions.create(
            {
              model: fbModel,
              messages: [{ role: "system", content: systemPrompt }, { role: "user", content: textOnlyContent }],
              ...(supportsJsonMode(fbModel) ? { response_format: { type: "json_object" as const } } : {}),
              max_tokens: maxTokens,
              temperature: 0.7,
            },
            { signal: reqController.signal },
          );
        } finally {
          clearTimeout(reqTimeout);
        }
        const raw = fbResponse.choices?.[0]?.message?.content ?? "";
        if (!raw) throw new Error("Empty response from fallback model");
        const stripped = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
        const match = stripped.match(/\{[\s\S]*\}/);
        if (!match) throw new Error("No JSON in fallback response");
        const sanitized = match[0].replace(/("(?:[^"\\]|\\.)*")/g, (m) =>
          m.replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/\t/g, "\\t")
        );
        return JSON.parse(sanitized);
      } catch (err) {
        if (!isRetriable(err)) throw err;
        await new Promise((r) => setTimeout(r, 500));
      }
    }
    throw lastErr;
  }

  // Text-only path: primary → fallbacks in order, 500ms gap between each
  const textModels = [model, ...fallbackModels];
  let lastErr: unknown;
  for (const id of textModels) {
    if (id !== model) await new Promise((r) => setTimeout(r, 500));
    try {
      console.log(`[openrouter] trying model: ${id}`);
      const result = await makeRequest(id, supportsJsonMode(id));
      console.log(`[openrouter] success: ${id}`);
      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[openrouter] model ${id} failed (${msg.slice(0, 80)})`);
      lastErr = err;
      if (!isRetriable(err)) throw err;
    }
  }
  console.error("[openrouter] all models exhausted. last error:", lastErr instanceof Error ? lastErr.message : lastErr);
  throw lastErr;
}

async function callProviderForMentor(
  userMessage: string,
  ageGroup: AgeGroup | null | undefined,
  tier: ModelTier = "default",
  imageUrl?: string,
): Promise<unknown> {
  // MENTOR_AI_PROVIDER lets the chat use a different provider than the rest of the app.
  // Falls back to AI_PROVIDER, then "openai".
  const providerName = process.env.MENTOR_AI_PROVIDER ?? process.env.AI_PROVIDER ?? "openai";
  const systemPrompt = getMentorSystemPrompt(ageGroup);

  if (providerName === "openrouter") {
    return callOpenRouter(systemPrompt, userMessage, 500, imageUrl);
  }

  if (providerName === "alibaba") {
    const apiKey = process.env.VITE_ALIBABA_API_KEY ?? process.env.ALIBABA_API_KEY;
    if (!apiKey) throw new Error("VITE_ALIBABA_API_KEY required for alibaba provider");
    return callOpenAICompatible(
      systemPrompt, userMessage, apiKey,
      process.env.VITE_ALIBABA_BASE_URL ?? "https://dashscope.aliyuncs.com/compatible-mode/v1",
      process.env.VITE_ALIBABA_MODEL ?? "qwen-plus",
      800,
    );
  }

  if (providerName === "anthropic") {
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
      timeout: API_TIMEOUT_MS,
    });

    const response = await client.messages.create({
      model: resolveModel("anthropic", tier, ANTHROPIC_BASE_MODEL),
      max_tokens: 800,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    });

    const textBlock = response.content.find((block: { type: string }) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("Empty response from Anthropic");
    }
    return JSON.parse(textBlock.text);
  }

  if (providerName === "google") {
    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) throw new Error("GOOGLE_AI_API_KEY required for google provider");
    return callOpenAICompatible(
      systemPrompt, userMessage, apiKey,
      "https://generativelanguage.googleapis.com/v1beta/openai/",
      GOOGLE_AI_MODEL, 8192,
    );
  }

  if (providerName === "vertex-ai") {
    const { VertexAI } = await import("@google-cloud/vertexai");
    const projectId = process.env.GOOGLE_CLOUD_PROJECT;
    if (!projectId) throw new Error("GOOGLE_CLOUD_PROJECT environment variable required for vertex-ai provider");

    const vertexAI = new VertexAI({
      project: projectId,
      location: process.env.GOOGLE_CLOUD_LOCATION ?? "us-central1",
    });

    const model = vertexAI.preview.getGenerativeModel({
      model: resolveModel("vertex-ai", tier, VERTEX_BASE_MODEL),
    });

    const response = await model.generateContent({
      contents: [
        {
          role: "user",
          parts: [
            { text: systemPrompt },
            { text: userMessage },
          ],
        },
      ],
      generation_config: {
        max_output_tokens: 500,
        temperature: 0.7,
      },
    });

    const result = response.response.candidates?.[0]?.content?.parts?.[0];
    if (!result?.text) throw new Error("Empty response from Vertex AI");
    return JSON.parse(result.text);
  }

  // Default to OpenAI
  const { default: OpenAI } = await import("openai");
  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    timeout: API_TIMEOUT_MS,
  });

  const response = await client.chat.completions.create({
    model: resolveModel("openai", tier, OPENAI_BASE_MODEL),
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
    response_format: { type: "json_object" },
    max_tokens: 500,
    temperature: 0.7,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error("Empty response from OpenAI");

  return JSON.parse(content);
}

const SIMPLIFY_SYSTEM_PROMPT = `You are a children's education specialist. Given mission instructions that are too complex, create a SIMPLIFIED version that:
1. Has fewer steps (3-4 instead of 5-6)
2. Uses simpler materials
3. Achieves the SAME learning goal
4. Is framed as a "Small Adjustment" — a smart choice, not a downgrade

NEVER use the words "fail", "wrong", "mistake", "easier". Always use "simpler approach", "small adjustment", "focused version".

Respond ONLY with valid JSON:
{
  "simplifiedInstructions": ["Step 1...", "Step 2...", "Step 3..."],
  "encouragementMessage": "A short, encouraging message about the adjustment"
}`;

/**
 * Generate simplified mission instructions via AI.
 *
 * Optional `currentZpdBand` enforces a ZPD floor — the simplification should
 * not drop below the child's current capability band. The AI is instructed
 * to stay within the band so the simplification remains challenging.
 */
export async function simplifyMission(
  originalInstructions: string[],
  missionTitle: string,
  materials: string[],
  currentZpdBand?: ZpdBand,
): Promise<SimplifiedMission> {
  if (process.env.USE_MOCK_AI === "true") {
    return getMockSimplifiedMission();
  }

  const zpdFloorLine = currentZpdBand
    ? `\nIMPORTANT — ZPD floor: this child is currently in the "${currentZpdBand}" capability band. The simplification must stay at or above this band: still requires effort and skill, just with fewer steps or simpler materials. Do NOT regress to a clearly trivial task.`
    : "";

  const userMessage = `Mission: "${missionTitle}"
Original Instructions: ${JSON.stringify(originalInstructions)}
Available Materials: ${materials.join(", ")}
${zpdFloorLine}

Create a simplified version of these instructions (3-4 steps max) using the simplest materials.`;

  const response = await callProviderForJSON(SIMPLIFY_SYSTEM_PROMPT, userMessage, 400, "default");
  return SimplifiedMissionSchema.parse(response);
}

const REFLECTION_SYSTEM_PROMPT = `You are a warm children's development specialist. Given a child's daily reflection about their mission, provide:
1. A brief, encouraging summary of what they shared (2-3 sentences)
2. Up to 3 specific strengths they showed (short phrases)
3. An encouraging closing message

NEVER be critical. Always find the positive. Use simple language.

Respond ONLY with valid JSON:
{
  "summary": "Brief summary...",
  "strengths": ["Strength 1", "Strength 2", "Strength 3"],
  "encouragement": "Encouraging closing message"
}`;

/**
 * Generate an AI summary of a child's daily reflection.
 */
export async function summarizeReflection(
  reflectionText: string,
  missionDay: number,
  missionTitle: string,
): Promise<ReflectionSummary> {
  if (process.env.USE_MOCK_AI === "true") {
    return getMockReflectionSummary();
  }

  const userMessage = `Day ${missionDay}: "${missionTitle}"

Child's reflection:
"${reflectionText}"

Summarize this reflection with encouragement.`;

  const response = await callProviderForJSON(REFLECTION_SYSTEM_PROMPT, userMessage, 300, "fast");
  return ReflectionSummarySchema.parse(response);
}

async function callProviderForJSON(
  systemPrompt: string,
  userMessage: string,
  maxTokens: number,
  tier: ModelTier = "default",
): Promise<unknown> {
  const providerName = process.env.MENTOR_AI_PROVIDER ?? process.env.AI_PROVIDER ?? "openai";

  if (providerName === "openrouter") {
    return callOpenRouter(systemPrompt, userMessage, maxTokens);
  }

  if (providerName === "alibaba") {
    const apiKey = process.env.VITE_ALIBABA_API_KEY ?? process.env.ALIBABA_API_KEY;
    if (!apiKey) throw new Error("VITE_ALIBABA_API_KEY required for alibaba provider");
    return callOpenAICompatible(
      systemPrompt, userMessage, apiKey,
      process.env.VITE_ALIBABA_BASE_URL ?? "https://dashscope.aliyuncs.com/compatible-mode/v1",
      process.env.VITE_ALIBABA_MODEL ?? "qwen-plus",
      maxTokens,
    );
  }

  if (providerName === "anthropic") {
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
      timeout: API_TIMEOUT_MS,
    });

    const response = await client.messages.create({
      model: resolveModel("anthropic", tier, ANTHROPIC_BASE_MODEL),
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    });

    const textBlock = response.content.find((block: { type: string }) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("Empty response from Anthropic");
    }
    return JSON.parse(textBlock.text);
  }

  if (providerName === "google") {
    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) throw new Error("GOOGLE_AI_API_KEY required for google provider");
    return callOpenAICompatible(
      systemPrompt, userMessage, apiKey,
      "https://generativelanguage.googleapis.com/v1beta/openai/",
      GOOGLE_AI_MODEL, maxTokens,
    );
  }

  if (providerName === "vertex-ai") {
    const { VertexAI } = await import("@google-cloud/vertexai");
    const projectId = process.env.GOOGLE_CLOUD_PROJECT;
    if (!projectId) throw new Error("GOOGLE_CLOUD_PROJECT environment variable required for vertex-ai provider");

    const vertexAI = new VertexAI({
      project: projectId,
      location: process.env.GOOGLE_CLOUD_LOCATION ?? "us-central1",
    });

    const model = vertexAI.preview.getGenerativeModel({
      model: resolveModel("vertex-ai", tier, VERTEX_BASE_MODEL),
    });

    const response = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: systemPrompt }, { text: userMessage }] }],
      generation_config: { max_output_tokens: maxTokens, temperature: 0.7 },
    });

    const result = response.response.candidates?.[0]?.content?.parts?.[0];
    if (!result?.text) throw new Error("Empty response from Vertex AI");
    return JSON.parse(result.text);
  }

  // Default to OpenAI
  const { default: OpenAI } = await import("openai");
  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    timeout: API_TIMEOUT_MS,
  });

  const response = await client.chat.completions.create({
    model: resolveModel("openai", tier, OPENAI_BASE_MODEL),
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
    response_format: { type: "json_object" },
    max_tokens: maxTokens,
    temperature: 0.7,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error("Empty response from OpenAI");

  return JSON.parse(content);
}
