/**
 * Anthropic Claude client for story narrative analysis, quest generation,
 * and gallery clustering.
 *
 * Story Analysis:
 *   Analyzes children's stories (typed text or transcribed audio) to detect
 *   talents through narrative patterns.
 *   Input: { storyText: string, imageIds: string[], submissionType: "text" | "audio" }
 *   Output: { talents: Array<{ name: string, confidence: number, reasoning: string }> }
 *
 * Quest Generation:
 *   Generates a personalized 7-day mission plan based on the child's detected
 *   talents, their dream, and local context (environment/resources).
 *   Input: { dream: string, localContext: string, talents?: Array<{ name, confidence, reasoning }> }
 *   Output: { missions: Array<{ day, title, description, instructions, materials, tips }> }
 *
 * Gallery Clustering:
 *   Groups gallery entries by talent category and geographic proximity.
 *   Generates meaningful, child-friendly cluster labels.
 *   Input: { entries: Array<{ id, talentCategory, country, coordinates }> }
 *   Output: { clusters: Array<{ id, label, description, talentTheme, countries, entryIds }> }
 *
 * Uses the mock layer when USE_MOCK_AI=true (default for development).
 */

import { AnalysisOutputSchema } from "./schemas";
import type { StoryAnalysisInput, StoryAnalysisOutput } from "./story-schemas";
import { getMockStoryAnalysis } from "./mock/story-analysis";
import {
  QuestGenerationOutputSchema,
  type QuestGenerationInput,
  type QuestGenerationOutput,
} from "./quest-schemas";
import { getMockQuestGeneration } from "./mock/quest-generation";
import {
  ClusteringOutputSchema,
  type ClusterEntry,
  type ClusteringOutput,
} from "./clustering-schemas";
import { getMockClustering } from "./mock/clustering";

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
 * System prompt for Claude quest generation.
 * Instructs Claude to create a personalized 7-day mission plan.
 */
const QUEST_SYSTEM_PROMPT = `You are a creative education specialist who designs personalized 7-day learning quests for children. Each quest transforms a child's dream into practical daily missions using locally available resources.

CRITICAL REQUIREMENTS:
1. Generate EXACTLY 7 daily missions (day 1 through day 7)
2. Missions must progress in complexity — Day 1 is simple/observational, Day 7 is a showcase
3. Adapt ALL materials to the child's local context (use what's available nearby)
4. Keep instructions clear and age-appropriate (8-14 years old)
5. Each mission should build on the previous day's learning
6. Materials should be free or very cheap — things found at home or in nature
7. Tips should be encouraging and help the child succeed

For each mission include:
- day: number (1-7)
- title: short, action-oriented title (3-5 words)
- description: 1-3 sentences explaining today's goal
- instructions: step-by-step numbered list (4-6 steps)
- materials: list of needed items (adapted to local context)
- tips: 2-4 helpful hints

Respond ONLY with valid JSON in this exact format:
{
  "missions": [
    {
      "day": 1,
      "title": "Mission Title",
      "description": "What the child will do today...",
      "instructions": ["Step 1...", "Step 2...", "Step 3..."],
      "materials": ["Item 1", "Item 2"],
      "tips": ["Tip 1", "Tip 2"]
    }
  ]
}`;

/**
 * Generate a personalized 7-day quest using Claude.
 *
 * Routes to mock responses when USE_MOCK_AI=true.
 */
export async function generateQuest(
  input: QuestGenerationInput,
): Promise<QuestGenerationOutput> {
  if (process.env.USE_MOCK_AI === "true") {
    return getMockQuestGeneration(input.dream);
  }

  return callClaudeForQuest(input);
}

/**
 * Make a real call to the Anthropic Claude API for quest generation.
 */
async function callClaudeForQuest(
  input: QuestGenerationInput,
): Promise<QuestGenerationOutput> {
  const Anthropic = (await import("@anthropic-ai/sdk")).default;

  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    timeout: API_TIMEOUT_MS,
  });

  const talentSummary = input.talents
    ? input.talents
        .map(
          (t) =>
            `- ${t.name} (confidence: ${Math.round(t.confidence * 100)}%): ${t.reasoning}`,
        )
        .join("\n")
    : "No specific talents detected yet.";

  const userMessage = `Create a 7-day quest for a child with these details:

**Dream:** "${input.dream}"

**Local Context:** "${input.localContext}"

**Detected Talents:**
${talentSummary}

Design missions that connect their dream with their talents, using materials available in their local environment. Make it practical, fun, and progressively challenging.`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    const response = await client.messages.create(
      {
        model: "claude-sonnet-4-20250514",
        max_tokens: 4000,
        system: QUEST_SYSTEM_PROMPT,
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
    const validated = QuestGenerationOutputSchema.parse(parsed);
    return validated;
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("Quest generation timed out. Please try again.");
    }

    throw error;
  }
}

/**
 * Make a real call to the Anthropic Claude API for story analysis.
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

/**
 * System prompt for Claude gallery clustering.
 * Instructs Claude to group gallery entries by talent and geography.
 */
const CLUSTERING_SYSTEM_PROMPT = `You are a creative education specialist who organizes children's gallery works into meaningful groups. Given gallery entries with talent categories and locations, create clusters that highlight connections between young creators around the world.

CRITICAL REQUIREMENTS:
1. Group entries by talent category first, then by geographic proximity
2. Generate child-friendly, encouraging cluster labels (e.g., "Robot Builders from Asia", "Young Artists from South America")
3. Each cluster should have a warm, encouraging description
4. Every entry must belong to exactly one cluster
5. Clusters should highlight the diversity and global reach of children's talents

For each cluster include:
- id: unique cluster identifier (e.g., "cluster-1")
- label: short, friendly label (3-6 words)
- description: encouraging description mentioning countries and talent
- talentTheme: the main talent category
- countries: list of countries represented
- entryIds: list of entry IDs in this cluster

Respond ONLY with valid JSON in this exact format:
{
  "clusters": [
    {
      "id": "cluster-1",
      "label": "Robot Builders from Asia",
      "description": "3 young talents from Indonesia and Japan are building amazing machines!",
      "talentTheme": "Engineering",
      "countries": ["Indonesia", "Japan"],
      "entryIds": ["entry-1", "entry-2", "entry-3"]
    }
  ]
}`;

/**
 * Cluster gallery entries using Claude AI.
 *
 * Routes to mock responses when USE_MOCK_AI=true.
 */
export async function clusterGalleryEntries(
  entries: ClusterEntry[],
): Promise<ClusteringOutput> {
  if (process.env.USE_MOCK_AI === "true") {
    return getMockClustering(entries);
  }

  return callClaudeForClustering(entries);
}

/**
 * Make a real call to the Anthropic Claude API for gallery clustering.
 */
async function callClaudeForClustering(
  entries: ClusterEntry[],
): Promise<ClusteringOutput> {
  const Anthropic = (await import("@anthropic-ai/sdk")).default;

  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    timeout: API_TIMEOUT_MS,
  });

  const entrySummary = entries
    .map(
      (e) =>
        `- ID: ${e.id}, Talent: ${e.talentCategory}, Country: ${e.country ?? "Unknown"}`,
    )
    .join("\n");

  const userMessage = `Group these ${entries.length} gallery entries into meaningful clusters:

${entrySummary}

Create clusters that highlight talent themes and geographic connections. Make labels child-friendly and encouraging.`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    const response = await client.messages.create(
      {
        model: "claude-sonnet-4-20250514",
        max_tokens: 2000,
        system: CLUSTERING_SYSTEM_PROMPT,
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
    const validated = ClusteringOutputSchema.parse(parsed);
    return validated;
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("Gallery clustering timed out. Please try again.");
    }

    throw error;
  }
}
