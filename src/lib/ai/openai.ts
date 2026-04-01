/**
 * OpenAI GPT-4o client for multimodal artifact analysis.
 *
 * Provides deep talent detection from uploaded images and audio artifacts.
 * Uses the mock layer when USE_MOCK_AI=true (default for development).
 *
 * Input: { artifactUrl: string, artifactType: "image" | "audio" }
 * Output: { talents: Array<{ name: string, confidence: number, reasoning: string }> }
 *
 * Prompt strategy: Instructs GPT-4o to look beyond surface-level categorization.
 * For example, a robot drawing should be analyzed for engineering interest
 * (mechanical detail focus), not just labeled as "art".
 */

import { AnalysisOutputSchema } from "./schemas";
import type { AnalysisInput, AnalysisOutput } from "./schemas";
import { getMockMultimodalAnalysis } from "./mock/multimodal-analysis";

/** Timeout for OpenAI API calls (30 seconds) */
const API_TIMEOUT_MS = 30_000;

/**
 * System prompt for GPT-4o multimodal analysis.
 * Instructs the model to detect deep interests and talents,
 * not just surface-level labels.
 */
const SYSTEM_PROMPT = `You are an expert child development specialist and talent scout. Your job is to analyze children's creative artifacts (drawings, paintings, photos, audio recordings) to detect their deep interests and talents.

CRITICAL: Go beyond surface-level categorization. Do NOT simply label a drawing as "art". Instead, analyze WHAT the child focused on and WHY:
- A robot drawing with detailed joints and cables → Engineering & Mechanics interest (they care about how things connect and move)
- A colorful landscape with balanced composition → Visual Arts talent (they understand color harmony and visual balance)
- An audio story with distinct character voices → Storytelling & Narrative talent (they naturally structure narratives)

For each detected talent:
1. Give it a specific, descriptive name (not generic labels like "creativity")
2. Rate your confidence from 0.0 to 1.0
3. Explain your reasoning in detail — describe WHAT specific elements you observed and WHY they indicate this talent

Respond ONLY with valid JSON in this exact format:
{
  "talents": [
    {
      "name": "Talent Name",
      "confidence": 0.85,
      "reasoning": "Detailed explanation of why this talent was detected..."
    }
  ]
}

Detect 2-4 talents per artifact. Be encouraging but honest.`;

/**
 * Analyze an artifact (image or audio) using GPT-4o multimodal analysis.
 *
 * Routes to mock responses when USE_MOCK_AI=true.
 */
export async function analyzeArtifact(
  input: AnalysisInput,
): Promise<AnalysisOutput> {
  if (process.env.USE_MOCK_AI === "true") {
    return getMockMultimodalAnalysis(input.artifactType);
  }

  return callOpenAI(input);
}

/**
 * Make a real call to the OpenAI GPT-4o API.
 *
 * Uses dynamic import to avoid loading the SDK when mocking.
 */
async function callOpenAI(input: AnalysisInput): Promise<AnalysisOutput> {
  const { default: OpenAI } = await import("openai");

  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    timeout: API_TIMEOUT_MS,
  });

  const userContent =
    input.artifactType === "image"
      ? [
          {
            type: "text" as const,
            text: "Please analyze this child's artwork and detect their interests and talents. Look beyond surface-level categorization.",
          },
          {
            type: "image_url" as const,
            image_url: { url: input.artifactUrl },
          },
        ]
      : [
          {
            type: "text" as const,
            text: `Please analyze this child's audio recording (available at: ${input.artifactUrl}) and detect their interests and talents based on vocal patterns, narrative structure, and content themes. Look beyond surface-level categorization.`,
          },
        ];

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    const response = await client.chat.completions.create(
      {
        model: "gpt-4o",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ],
        response_format: { type: "json_object" },
        max_tokens: 1500,
        temperature: 0.7,
      },
      { signal: controller.signal },
    );

    clearTimeout(timeoutId);

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("Empty response from OpenAI");
    }

    const parsed = JSON.parse(content);
    const validated = AnalysisOutputSchema.parse(parsed);
    return validated;
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("Analysis timed out. Please try again.");
    }

    throw error;
  }
}
