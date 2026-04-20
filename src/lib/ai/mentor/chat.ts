/**
 * Quest Buddy mentor chat — Socratic scaffolding engine.
 *
 * Uses Claude to generate question-first guidance that adapts to the
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

  return callClaudeMentor(childMessage, frustrationLevel, missionContext, chatHistory, isGreeting);
}

async function callClaudeMentor(
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
  const Anthropic = (await import("@anthropic-ai/sdk")).default;

  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    timeout: API_TIMEOUT_MS,
  });

  const userMessage = buildUserMessage(childMessage, frustrationLevel, missionContext, chatHistory, isGreeting);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    const response = await client.messages.create(
      {
        model: "claude-sonnet-4-20250514",
        max_tokens: 500,
        system: MENTOR_SYSTEM_PROMPT,
        messages: [{ role: "user", content: userMessage }],
      },
      { signal: controller.signal },
    );

    clearTimeout(timeoutId);

    const textBlock = response.content.find(
      (block: { type: string }) => block.type === "text",
    );
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("Empty response from Claude");
    }

    const parsed = JSON.parse(textBlock.text);
    return MentorResponseSchema.parse(parsed);
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("Mentor chat timed out. Please try again.");
    }
    throw error;
  }
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

  const Anthropic = (await import("@anthropic-ai/sdk")).default;
  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    timeout: API_TIMEOUT_MS,
  });

  const userMessage = `Mission: "${missionTitle}"
Original Instructions: ${JSON.stringify(originalInstructions)}
Available Materials: ${materials.join(", ")}

Create a simplified version of these instructions (3-4 steps max) using the simplest materials.`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    const response = await client.messages.create(
      {
        model: "claude-sonnet-4-20250514",
        max_tokens: 400,
        system: SIMPLIFY_SYSTEM_PROMPT,
        messages: [{ role: "user", content: userMessage }],
      },
      { signal: controller.signal },
    );

    clearTimeout(timeoutId);

    const textBlock = response.content.find(
      (block: { type: string }) => block.type === "text",
    );
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("Empty response from Claude");
    }

    const parsed = JSON.parse(textBlock.text);
    return SimplifiedMissionSchema.parse(parsed);
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
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

  const Anthropic = (await import("@anthropic-ai/sdk")).default;
  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    timeout: API_TIMEOUT_MS,
  });

  const userMessage = `Day ${missionDay}: "${missionTitle}"

Child's reflection:
"${reflectionText}"

Summarize this reflection with encouragement.`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    const response = await client.messages.create(
      {
        model: "claude-sonnet-4-20250514",
        max_tokens: 300,
        system: REFLECTION_SYSTEM_PROMPT,
        messages: [{ role: "user", content: userMessage }],
      },
      { signal: controller.signal },
    );

    clearTimeout(timeoutId);

    const textBlock = response.content.find(
      (block: { type: string }) => block.type === "text",
    );
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("Empty response from Claude");
    }

    const parsed = JSON.parse(textBlock.text);
    return ReflectionSummarySchema.parse(parsed);
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}
