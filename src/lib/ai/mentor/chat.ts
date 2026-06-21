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

const API_TIMEOUT_MS = 30_000;
const ANTHROPIC_BASE_MODEL = "claude-sonnet-4-20250514";
const OPENAI_BASE_MODEL = "gpt-4o";
const VERTEX_BASE_MODEL = process.env.VERTEX_AI_MODEL ?? "gemini-2.5-flash";

/** Context builder — assembles the conversation context for Claude */
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
): string {
  const missionInfo = `[Mission Context — Day ${missionContext.day}: ${missionContext.title}]
Description: ${missionContext.description}
Instructions: ${missionContext.instructions.map((s, i) => `${i + 1}. ${s}`).join("\n")}
Materials: ${missionContext.materials.join(", ")}
Current Frustration Level: ${frustrationLevel}`;

  if (isGreeting) {
    return `${missionInfo}\n\nThe child just started this mission. Greet them warmly and introduce yourself as their Quest Buddy. Ask an opening question about the mission.`;
  }

  const recentHistory = chatHistory
    .slice(-6)
    .map((m) => `${m.role === "child" ? "Child" : "Mentor"}: ${m.content}`)
    .join("\n");

  return `${missionInfo}\n\n[Recent conversation]\n${recentHistory}\n\nChild says: "${childMessage}"\n\nRespond as the mentor. Remember to use Socratic questioning and adapt to the frustration level.`;
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
): Promise<MentorResponse> {
  const userMessage = buildUserMessage(childMessage, frustrationLevel, missionContext, chatHistory, isGreeting);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    // Provider selection happens inside callProviderForMentor via AI_PROVIDER env.
    const response = await callProviderForMentor(userMessage, ageGroup, "smart");

    clearTimeout(timeoutId);
    return MentorResponseSchema.parse(response);
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("Mentor chat timed out. Please try again.");
    }
    throw error;
  }
}

async function callProviderForMentor(
  userMessage: string,
  ageGroup: AgeGroup | null | undefined,
  tier: ModelTier = "default",
): Promise<unknown> {
  const providerName = process.env.AI_PROVIDER ?? "openai";
  const systemPrompt = getMentorSystemPrompt(ageGroup);

  if (providerName === "anthropic") {
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
      timeout: API_TIMEOUT_MS,
    });

    const response = await client.messages.create({
      model: resolveModel("anthropic", tier, ANTHROPIC_BASE_MODEL),
      max_tokens: 500,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    });

    const textBlock = response.content.find((block: { type: string }) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("Empty response from Anthropic");
    }
    return JSON.parse(textBlock.text);
  }

  if (providerName === "google" || providerName === "vertex-ai") {
    const { VertexAI } = await import("@google-cloud/vertexai");
    const projectId = process.env.GOOGLE_CLOUD_PROJECT;

    if (!projectId) {
      throw new Error("GOOGLE_CLOUD_PROJECT environment variable required for Vertex AI");
    }

    const vertexAI = new VertexAI({
      project: projectId,
      location: process.env.GOOGLE_CLOUD_LOCATION ?? "us-central1",
    });

    const model = vertexAI.preview.getGenerativeModel({
      model: resolveModel(
        providerName === "vertex-ai" ? "vertex-ai" : "google",
        tier,
        VERTEX_BASE_MODEL,
      ),
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
    if (!result?.text) {
      throw new Error("Empty response from Vertex AI");
    }
    return JSON.parse(result.text);
  }

  // Default to OpenAI-compatible APIs (OpenAI, DashScope/Qwen, etc.).
  const { default: OpenAI } = await import("openai");
  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENAI_BASE_URL,
    timeout: API_TIMEOUT_MS,
  });

  const response = await client.chat.completions.create({
    model: resolveModel("openai", tier, process.env.OPENAI_MODEL ?? OPENAI_BASE_MODEL),
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
  const providerName = process.env.AI_PROVIDER ?? "openai";

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

  if (providerName === "google" || providerName === "vertex-ai") {
    const { VertexAI } = await import("@google-cloud/vertexai");
    const projectId = process.env.GOOGLE_CLOUD_PROJECT;

    if (!projectId) {
      throw new Error("GOOGLE_CLOUD_PROJECT environment variable required for Vertex AI");
    }

    const vertexAI = new VertexAI({
      project: projectId,
      location: process.env.GOOGLE_CLOUD_LOCATION ?? "us-central1",
    });

    const model = vertexAI.preview.getGenerativeModel({
      model: resolveModel(
        providerName === "vertex-ai" ? "vertex-ai" : "google",
        tier,
        VERTEX_BASE_MODEL,
      ),
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
        max_output_tokens: maxTokens,
        temperature: 0.7,
      },
    });

    const result = response.response.candidates?.[0]?.content?.parts?.[0];
    if (!result?.text) {
      throw new Error("Empty response from Vertex AI");
    }
    return JSON.parse(result.text);
  }

  // Default to OpenAI-compatible APIs (OpenAI, DashScope/Qwen, etc.).
  const { default: OpenAI } = await import("openai");
  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENAI_BASE_URL,
    timeout: API_TIMEOUT_MS,
  });

  const response = await client.chat.completions.create({
    model: resolveModel("openai", tier, process.env.OPENAI_MODEL ?? OPENAI_BASE_MODEL),
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
