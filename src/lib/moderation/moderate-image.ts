/**
 * Image content moderation using OpenAI GPT-4o.
 */

import type { ModerationResult } from "./schemas";
import { mapToModerationResult } from "./map-result";
import { getMockImageModeration } from "./mock/moderation";

const MODERATION_TIMEOUT_MS = 20_000;

const IMAGE_MODERATION_PROMPT = `You are a child safety image moderator. Analyze the provided image for any harmful, inappropriate, or unsafe content for children (ages 6-12).

Check for:
- violence: Graphic violence, weapons, fighting scenes
- self_harm: Self-injury imagery, concerning symbols
- sexual: Inappropriate or sexual content
- hate: Hate symbols, discriminatory imagery
- harassment: Bullying or targeting imagery
- other: Any other concerning visual content

Respond ONLY with valid JSON:
{
  "isHarmful": boolean,
  "category": "violence" | "self_harm" | "sexual" | "hate" | "harassment" | "other" | null,
  "severity": "low" | "medium" | "high" | "critical" | null,
  "confidence": number (0.0-1.0),
  "reasoning": "Brief explanation"
}

Be CONSERVATIVE: when in doubt, flag for review. Children's safety is paramount.`;

export async function moderateImage(imageUrl: string): Promise<ModerationResult> {
  if (process.env.USE_MOCK_AI === "true") {
    return getMockImageModeration(imageUrl);
  }

  return callOpenAIForImageModeration(imageUrl);
}

async function callOpenAIForImageModeration(
  imageUrl: string,
): Promise<ModerationResult> {
  const { default: OpenAI } = await import("openai");

  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    timeout: MODERATION_TIMEOUT_MS,
  });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), MODERATION_TIMEOUT_MS);

  try {
    const response = await client.chat.completions.create(
      {
        model: "gpt-4o",
        messages: [
          { role: "system", content: IMAGE_MODERATION_PROMPT },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Analyze this image for child safety concerns:",
              },
              {
                type: "image_url",
                image_url: { url: imageUrl },
              },
            ],
          },
        ],
        response_format: { type: "json_object" },
        max_tokens: 300,
        temperature: 0,
      },
      { signal: controller.signal },
    );

    clearTimeout(timeoutId);

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return {
        allowed: false,
        status: "flagged",
        category: "other",
        severity: "medium",
        confidence: 0,
        reasoning: "Moderation response was empty",
      };
    }

    const parsed = JSON.parse(content);
    return mapToModerationResult(parsed);
  } catch (error) {
    clearTimeout(timeoutId);
    console.error("Image moderation error:", error);
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


