/**
 * Anthropic Claude client for story narrative analysis.
 *
 * Analyzes children's stories (typed text or transcribed audio) to detect
 * talents through narrative patterns. Claude examines:
 * - Story structure (beginning, middle, end)
 * - Vocabulary and language use
 * - Creative elements (imagination, world-building)
 * - Emotional content (empathy, character depth)
 * - Logical reasoning (cause-and-effect, problem-solving)
 *
 * Input: { storyText: string, imageIds: string[], submissionType: "text" | "audio" }
 * Output: { talents: Array<{ name: string, confidence: number, reasoning: string }> }
 *
 * Uses the mock layer when USE_MOCK_AI=true (default for development).
 */

import { AnalysisOutputSchema } from "./schemas";
import type { StoryAnalysisInput, StoryAnalysisOutput } from "./story-schemas";
import { getMockStoryAnalysis } from "./mock/story-analysis";

/** Timeout for Claude API calls (30 seconds) */
const API_TIMEOUT_MS = 30_000;

/**
 * System prompt for Claude story analysis.
 * Instructs Claude to detect deep talents through narrative pattern analysis.
 */
const SYSTEM_PROMPT = `You are an expert child development specialist who analyzes children's stories to discover their unique talents and interests. The child was shown 3 random images and asked to create a story inspired by them.

CRITICAL: Analyze the NARRATIVE PATTERNS, not just the content:
- A story with clear cause-and-effect chains → Logical Thinking (they naturally reason through consequences)
- A story blending reality and fantasy → Creative Imagination (they transform the ordinary into extraordinary)
- A story focused on characters' feelings → Emotional Intelligence (they naturally consider others' perspectives)
- A story incorporating real-world knowledge → Scientific Curiosity (they observe and explain how things work)
- A story with a clear problem and solution → Problem-Solving (they think systematically about challenges)

For each detected talent:
1. Give it a specific, descriptive name (not generic labels)
2. Rate your confidence from 0.0 to 1.0
3. Explain your reasoning in detail — reference SPECIFIC elements from the story that indicate this talent

Respond ONLY with valid JSON in this exact format:
{
  "talents": [
    {
      "name": "Talent Name",
      "confidence": 0.85,
      "reasoning": "Detailed explanation referencing specific story elements..."
    }
  ]
}

Detect 2-4 talents per story. Be encouraging and specific.`;

/**
 * Analyze a child's story using Claude narrative analysis.
 *
 * Routes to mock responses when USE_MOCK_AI=true.
 */
export async function analyzeStory(
  input: StoryAnalysisInput,
): Promise<StoryAnalysisOutput> {
  if (process.env.USE_MOCK_AI === "true") {
    return getMockStoryAnalysis(input.submissionType);
  }

  return callClaude(input);
}

/**
 * Make a real call to the Anthropic Claude API.
 *
 * Uses dynamic import to avoid loading the SDK when mocking.
 */
async function callClaude(
  input: StoryAnalysisInput,
): Promise<StoryAnalysisOutput> {
  const Anthropic = (await import("@anthropic-ai/sdk")).default;

  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    timeout: API_TIMEOUT_MS,
  });

  const userMessage = input.submissionType === "audio"
    ? `This is a transcription of a child's spoken story after viewing 3 images (IDs: ${input.imageIds.join(", ")}). Please analyze the narrative patterns:\n\n"${input.storyText}"`
    : `This is a child's written story after viewing 3 images (IDs: ${input.imageIds.join(", ")}). Please analyze the narrative patterns:\n\n"${input.storyText}"`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    const response = await client.messages.create(
      {
        model: "claude-sonnet-4-20250514",
        max_tokens: 1500,
        system: SYSTEM_PROMPT,
        messages: [
          { role: "user", content: userMessage },
        ],
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
    const validated = AnalysisOutputSchema.parse(parsed);
    return validated;
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("Story analysis timed out. Please try again.");
    }

    throw error;
  }
}
