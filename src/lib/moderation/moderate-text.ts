/**
 * Text content moderation using Claude AI.
 */

import type { ModerationResult } from "./schemas";
import { mapToModerationResult } from "./map-result";
import { getMockTextModeration } from "./mock/moderation";

const MODERATION_TIMEOUT_MS = 15_000;

const TEXT_MODERATION_PROMPT = `You are a child safety content moderator. Analyze the following text content for any harmful, inappropriate, or unsafe material for children (ages 6-12).

Check for these categories:
- violence: Threats, graphic violence, weapons, fighting
- self_harm: Self-injury, depression, suicidal content
- sexual: Sexual content, inappropriate advances
- hate: Hate speech, discrimination, slurs
- harassment: Bullying, targeted harassment, intimidation
- spam: Repetitive, irrelevant, or promotional content
- other: Any other concerning content

Respond ONLY with valid JSON:
{
  "isHarmful": boolean,
  "category": "violence" | "self_harm" | "sexual" | "hate" | "harassment" | "spam" | "other" | null,
  "severity": "low" | "medium" | "high" | "critical" | null,
  "confidence": number (0.0-1.0),
  "reasoning": "Brief explanation of the decision"
}

Be CONSERVATIVE: when in doubt, flag for review rather than allowing. Children's safety is paramount.`;

export async function moderateText(content: string): Promise<ModerationResult> {
  if (process.env.USE_MOCK_AI === "true") {
    return getMockTextModeration(content);
  }

  return callClaudeForModeration(content);
}

async function callClaudeForModeration(
  content: string,
): Promise<ModerationResult> {
  const Anthropic = (await import("@anthropic-ai/sdk")).default;

  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    timeout: MODERATION_TIMEOUT_MS,
  });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), MODERATION_TIMEOUT_MS);

  try {
    const response = await client.messages.create(
      {
        model: "claude-sonnet-4-20250514",
        max_tokens: 300,
        system: TEXT_MODERATION_PROMPT,
        messages: [
          {
            role: "user",
            content: `Analyze this text for child safety:\n\n"${content}"`,
          },
        ],
      },
      { signal: controller.signal },
    );

    clearTimeout(timeoutId);

    const textBlock = response.content.find(
      (block: { type: string }) => block.type === "text",
    );
    if (!textBlock || textBlock.type !== "text") {
      return {
        allowed: false,
        status: "flagged",
        category: "other",
        severity: "medium",
        confidence: 0,
        reasoning: "Moderation response could not be parsed",
      };
    }

    const parsed = JSON.parse(textBlock.text);
    return mapToModerationResult(parsed);
  } catch (error) {
    clearTimeout(timeoutId);
    console.error("Text moderation error:", error);
    return {
      allowed: true,
      status: "flagged",
      category: undefined,
      severity: undefined,
      confidence: 0,
      reasoning: "Moderation failed, flagged for async review",
    };
  }
}


