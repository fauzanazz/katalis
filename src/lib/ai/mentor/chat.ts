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

import type {
  MentorResponse,
  SimplifiedMission,
  ReflectionSummary,
  FrustrationLevel,
} from "../mentor-schemas";
import { MentorResponseSchema, SimplifiedMissionSchema, ReflectionSummarySchema } from "../mentor-schemas";
import { getMockMentorChat, getMockSimplifiedMission, getMockReflectionSummary } from "./mock-chat";
import { getProvider } from "../providers";

const API_TIMEOUT_MS = 30_000;

/** System prompt for the Socratic mentor */
const MENTOR_SYSTEM_PROMPT = `You are a warm, encouraging mentor for children aged 6–12. You guide them through creative missions using SOCRATIC QUESTIONING — you NEVER give direct answers or solutions. Instead, you ask questions that help the child think and discover answers themselves.

CRITICAL RULES:
1. NEVER say: "fail", "wrong", "mistake", "incorrect", "try again", "that's not right"
2. ALWAYS say: "small adjustment", "different approach", "interesting idea", "let's explore"
3. Keep responses SHORT (1–3 sentences max). Children lose attention with long text.
4. Use simple words. The child may be a pre-reader or early reader.
5. Be genuinely curious about their ideas. Celebrate their thinking process.
6. Use emojis sparingly (1–2 per message max) for warmth.

FRUSTRATION ADAPTATION:
- none: Ask open-ended questions ("What do you think would happen if…?")
- low: Offer gentle hints ("Have you looked at the materials list?")
- medium: Give guided hints + offer "Small Adjustment" option
- high: Strongly suggest a "Small Adjustment" — simplify the mission

When offering a "Small Adjustment", explain it as a SMART choice, not a step back.
Say things like: "Let's try a Small Adjustment — this is what real engineers do when they want to make progress faster!"

RESPONSE FORMAT — respond ONLY with valid JSON:
{
  "message": "Your mentor message (1-3 sentences)",
  "suggestions": ["Quick reply option 1", "Quick reply option 2", "Quick reply option 3"],
  "frustrationLevel": "none|low|medium|high",
  "offerAdjustment": false
}

Always provide exactly 3 quick reply suggestions that the child can tap.`;

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
): Promise<MentorResponse> {
  if (process.env.USE_MOCK_AI === "true") {
    return getMockMentorChat(childMessage, frustrationLevel, isGreeting);
  }

  return generateMentorResponse(childMessage, frustrationLevel, missionContext, chatHistory, isGreeting);
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
): Promise<MentorResponse> {
  const provider = getProvider();
  const userMessage = buildUserMessage(childMessage, frustrationLevel, missionContext, chatHistory, isGreeting);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    // Use provider's text generation capability for mentor chat
    // Since AIProvider doesn't have a generic generateText method,
    // we'll leverage the text moderation or use a workaround
    // For now, create a lightweight wrapper that calls the provider's API
    
    // Get the underlying provider implementation
    const providerImpl = await (async () => {
      const providers = {
        anthropic: () => import("../providers/anthropic").then(m => m.anthropicProvider),
        openai: () => import("../providers/openai").then(m => m.openaiProvider),
        google: () => import("../providers/google").then(m => m.googleProvider),
        "vertex-ai": () => import("../providers/vertex-ai").then(m => m.vertexAiProvider),
        openrouter: () => import("../providers/openrouter").then(m => m.openrouterProvider),
        nvidia: () => import("../providers/nvidia").then(m => m.nvidiaProvider),
        grok: () => import("../providers/grok").then(m => m.grokProvider),
      };
      
      const providerName = (process.env.AI_PROVIDER ?? "openai") as keyof typeof providers;
      return providers[providerName]?.() ?? import("../providers/openai").then(m => m.openaiProvider);
    })();

    // This is a fallback - ideally we'd have a generic generateJSON method on AIProvider
    // For now, we'll use the direct client approach as before but make it provider-aware
    const response = await callProviderForMentor(userMessage);

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

async function callProviderForMentor(userMessage: string): Promise<unknown> {
  const providerName = process.env.AI_PROVIDER ?? "openai";

  if (providerName === "anthropic") {
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
      timeout: API_TIMEOUT_MS,
    });

    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 500,
      system: MENTOR_SYSTEM_PROMPT,
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

    const model = vertexAI.getGenerativeModel({
      model: process.env.VERTEX_AI_MODEL ?? "gemini-2.0-flash",
    });

    const response = await model.generateContent({
      contents: [
        {
          role: "user",
          parts: [
            { text: MENTOR_SYSTEM_PROMPT },
            { text: userMessage },
          ],
        },
      ],
      generationConfig: {
        maxOutputTokens: 500,
        temperature: 0.7,
      },
    });

    const result = response.response.candidates?.[0]?.content?.parts?.[0];
    if (!result?.text) {
      throw new Error("Empty response from Vertex AI");
    }
    return JSON.parse(result.text);
  }

  // Default to OpenAI
  const { default: OpenAI } = await import("openai");
  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    timeout: API_TIMEOUT_MS,
  });

  const response = await client.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: MENTOR_SYSTEM_PROMPT },
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
 */
export async function simplifyMission(
  originalInstructions: string[],
  missionTitle: string,
  materials: string[],
): Promise<SimplifiedMission> {
  if (process.env.USE_MOCK_AI === "true") {
    return getMockSimplifiedMission();
  }

  const userMessage = `Mission: "${missionTitle}"
Original Instructions: ${JSON.stringify(originalInstructions)}
Available Materials: ${materials.join(", ")}

Create a simplified version of these instructions (3-4 steps max) using the simplest materials.`;

  const response = await callProviderForJSON(SIMPLIFY_SYSTEM_PROMPT, userMessage, 400);
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

  const response = await callProviderForJSON(REFLECTION_SYSTEM_PROMPT, userMessage, 300);
  return ReflectionSummarySchema.parse(response);
}

async function callProviderForJSON(
  systemPrompt: string,
  userMessage: string,
  maxTokens: number,
): Promise<unknown> {
  const providerName = process.env.AI_PROVIDER ?? "openai";

  if (providerName === "anthropic") {
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
      timeout: API_TIMEOUT_MS,
    });

    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
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

    const model = vertexAI.getGenerativeModel({
      model: process.env.VERTEX_AI_MODEL ?? "gemini-2.0-flash",
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
      generationConfig: {
        maxOutputTokens: maxTokens,
        temperature: 0.7,
      },
    });

    const result = response.response.candidates?.[0]?.content?.parts?.[0];
    if (!result?.text) {
      throw new Error("Empty response from Vertex AI");
    }
    return JSON.parse(result.text);
  }

  // Default to OpenAI
  const { default: OpenAI } = await import("openai");
  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    timeout: API_TIMEOUT_MS,
  });

  const response = await client.chat.completions.create({
    model: "gpt-4o",
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
