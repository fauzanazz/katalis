/**
 * Multi-tag classifier for gallery entries.
 * Uses configurable AI provider to generate semantic tags from talent category and quest context.
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

  const userMessage = `Primary talent: ${talentCategory}${questContext ? `\nQuest context: ${questContext}` : ""}

Generate specific semantic tags for this child's work.`;

  const response = await callProviderForTags(userMessage);
  const parsed = JSON.parse(response);
  return TagClassificationOutputSchema.parse(parsed);
}

async function callProviderForTags(userMessage: string): Promise<string> {
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
      system: TAG_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });

    const textBlock = response.content.find((block: { type: string }) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("Empty response from Anthropic");
    }
    return textBlock.text;
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
      model: process.env.VERTEX_AI_MODEL ?? "gemini-2.5-flash",
    });

    const response = await model.generateContent({
      contents: [
        {
          role: "user",
          parts: [
            { text: TAG_SYSTEM_PROMPT },
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
    return result.text;
  }

  // Default to OpenAI-compatible APIs (OpenAI, DashScope/Qwen, etc.).
  const { default: OpenAI } = await import("openai");
  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENAI_BASE_URL,
    timeout: API_TIMEOUT_MS,
  });

  const response = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL ?? "gpt-4o",
    messages: [
      { role: "system", content: TAG_SYSTEM_PROMPT },
      { role: "user", content: userMessage },
    ],
    response_format: { type: "json_object" },
    max_tokens: 500,
    temperature: 0.7,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error("Empty response from OpenAI");

  return content;
}
