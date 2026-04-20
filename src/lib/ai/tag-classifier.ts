/**
 * Multi-tag classifier for gallery entries.
 * Uses Claude AI to generate semantic tags from talent category and quest context.
 * Routes to mock when USE_MOCK_AI=true.
 */

import { getMockTagClassification } from "./mock/tag-classifier";
import { TagClassificationOutputSchema, type TagClassificationOutput } from "./tag-schemas";

const TAG_SYSTEM_PROMPT = `You are a children's talent classification specialist. Given a child's primary talent category and their quest context, generate 2-5 specific semantic tags that describe their abilities and interests in more detail.

For each tag provide:
- name: a short, specific skill/interest label (2-3 words)
- confidence: how well it matches (0.0-1.0)
- category: the broad category it belongs to (Engineering, Art, Narrative, Music, Science, Creative, Leadership, Empathy)

Tags should be encouraging and specific to what the child demonstrated. Include at least one cross-category tag if relevant.

Respond ONLY with valid JSON:
{
  "tags": [
    { "name": "Mechanical Design", "confidence": 0.9, "category": "Engineering" },
    { "name": "Creative Problem Solving", "confidence": 0.75, "category": "Creative" }
  ]
}`;

const API_TIMEOUT_MS = 15000;

export async function classifyTags(
  talentCategory: string,
  questContext?: string,
): Promise<TagClassificationOutput> {
  if (process.env.USE_MOCK_AI === "true") {
    return getMockTagClassification(talentCategory, questContext);
  }

  const Anthropic = (await import("@anthropic-ai/sdk")).default;
  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    timeout: API_TIMEOUT_MS,
  });

  const userMessage = `Primary talent: ${talentCategory}${questContext ? `\nQuest context: ${questContext}` : ""}

Generate specific semantic tags for this child's work.`;

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 500,
    system: TAG_SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
  });

  const textBlock = response.content.find((block: { type: string }) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Empty response from tag classifier");
  }

  const parsed = JSON.parse(textBlock.text);
  return TagClassificationOutputSchema.parse(parsed);
}
