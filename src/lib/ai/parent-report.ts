/**
 * AI-powered parent report generator.
 * Uses configurable AI provider to analyze child's activities and generate insightful reports.
 * Routes to mock when USE_MOCK_AI=true.
 */

import { z } from "zod";
import { getMockParentReport } from "./mock/parent-report";
import type { HomeTip } from "@/lib/parent/schemas";

const REPORT_SYSTEM_PROMPT = `You are an expert child development specialist writing a report for parents. Analyze the child's recent activities and generate a structured report.

You must respond with ONLY valid JSON in this format:
{
  "strengths": ["strength 1", "strength 2", "strength 3"],
  "growthAreas": ["growth area 1", "growth area 2"],
  "tips": [
    { "title": "tip title", "description": "detailed description", "materials": ["item 1"], "category": "talent category" }
  ],
  "summary": "A warm, encouraging 2-3 sentence summary of the child's progress",
  "badgeHighlights": ["badge_slug_1"]
}

Rules:
- Strengths: 2-4 specific, encouraging observations about what the child did well
- Growth areas: 1-2 constructive suggestions framed positively (not weaknesses)
- Tips: 2-3 practical at-home activities using common household materials
- Summary: warm, specific, and encouraging
- Keep language parent-friendly, not academic`;

const API_TIMEOUT_MS = 20000;

interface ReportInput {
  childTalents: string[];
  completedQuests: number;
  completedMissions: number;
  badgesEarned: string[];
  reflectionsCount: number;
  mentorInteractions: number;
  periodStart: string;
  periodEnd: string;
  localContext?: string;
}

interface ReportOutput {
  strengths: string[];
  growthAreas: string[];
  tips: HomeTip[];
  summary: string;
  badgeHighlights: string[];
}

const ReportOutputSchema = z.object({
  strengths: z.array(z.string()),
  growthAreas: z.array(z.string()),
  tips: z.array(z.object({
    title: z.string().min(1),
    description: z.string().min(1),
    materials: z.array(z.string()),
    category: z.string().min(1),
  })),
  summary: z.string().min(1),
  badgeHighlights: z.array(z.string()),
});

export async function generateAIReport(input: ReportInput): Promise<ReportOutput> {
  if (process.env.USE_MOCK_AI === "true") {
    return getMockParentReport({
      childTalents: input.childTalents,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
    });
  }

  const userMessage = `Child profile:
- Detected talents: ${input.childTalents.join(", ")}
- Completed quests: ${input.completedQuests}
- Completed missions: ${input.completedMissions}
- Badges earned: ${input.badgesEarned.join(", ") || "None yet"}
- Reflections written: ${input.reflectionsCount}
- Mentor interactions: ${input.mentorInteractions}
- Period: ${input.periodStart} to ${input.periodEnd}
${input.localContext ? `- Local context: ${input.localContext}` : ""}

Generate a parent progress report for this period.`;

  const response = await callProviderForReport(userMessage);
  const parsed = JSON.parse(response);
  return ReportOutputSchema.parse(parsed);
}

async function callProviderForReport(userMessage: string): Promise<string> {
  const providerName = process.env.AI_PROVIDER ?? "openai";

  if (providerName === "anthropic") {
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
      timeout: API_TIMEOUT_MS,
    });

    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1500,
      system: REPORT_SYSTEM_PROMPT,
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

    const model = vertexAI.getGenerativeModel({
      model: process.env.VERTEX_AI_MODEL ?? "gemini-2.0-flash",
    });

    const response = await model.generateContent({
      contents: [
        {
          role: "user",
          parts: [
            { text: REPORT_SYSTEM_PROMPT },
            { text: userMessage },
          ],
        },
      ],
      generationConfig: {
        maxOutputTokens: 1500,
        temperature: 0.7,
      },
    });

    const result = response.response.candidates?.[0]?.content?.parts?.[0];
    if (!result?.text) {
      throw new Error("Empty response from Vertex AI");
    }
    return result.text;
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
      { role: "system", content: REPORT_SYSTEM_PROMPT },
      { role: "user", content: userMessage },
    ],
    response_format: { type: "json_object" },
    max_tokens: 1500,
    temperature: 0.7,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error("Empty response from OpenAI");

  return content;
}
