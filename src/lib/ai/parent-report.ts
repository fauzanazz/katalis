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
- Keep language parent-friendly, not academic

PYGMALION SAFEGUARD (Katalis.docx §8.1): NEVER label the child with fixed-trait
language such as "your child IS an engineer", "she is a born artist", "he is the
kinesthetic type". Always frame interests as currently expressed behavior:
"is currently enjoying", "shows interest in this week", "is exploring".
Avoid academic jargon — no "kinesthetic intelligence", "linguistic intelligence",
etc. Use plain language: "loves hands-on activities", "enjoys telling stories".
Interests CHANGE — encourage parents to expect evolution.

GROWTH MINDSET (Dweck): praise effort and process, not innate ability. Say
"worked hard on", "kept trying when X was tricky"; avoid "is so smart",
"is a natural".`;

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
  const jsonMatch = response.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON found in AI response");
  const parsed = JSON.parse(jsonMatch[0]);
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
    const { default: OpenAI } = await import("openai");
    const client = new OpenAI({
      apiKey: process.env.GOOGLE_AI_API_KEY,
      baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
      timeout: API_TIMEOUT_MS,
    });

    const response = await client.chat.completions.create({
      model: process.env.GOOGLE_AI_MODEL ?? "gemini-2.5-flash",
      messages: [
        { role: "system", content: REPORT_SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
      max_tokens: 1500,
      temperature: 0.7,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error("Empty response from Google AI");
    return content;
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
