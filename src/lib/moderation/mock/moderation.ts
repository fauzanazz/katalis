/**
 * Mock moderation responses for development and testing.
 */

import type { ModerationResult } from "../schemas";

export async function getMockTextModeration(
  _content: string,
): Promise<ModerationResult> {
  await new Promise((resolve) => setTimeout(resolve, 100 + Math.random() * 200));

  return {
    allowed: true,
    status: "approved",
    confidence: 0.98,
    reasoning: "Content appears safe for children",
  };
}

export async function getMockImageModeration(
  _imageUrl: string,
): Promise<ModerationResult> {
  await new Promise((resolve) => setTimeout(resolve, 200 + Math.random() * 300));

  return {
    allowed: true,
    status: "approved",
    confidence: 0.97,
    reasoning: "Image appears safe for children",
  };
}

export function getMockBlockedResult(
  category: string = "violence",
): ModerationResult {
  return {
    allowed: false,
    status: "blocked",
    category: category as ModerationResult["category"],
    severity: "high",
    confidence: 0.92,
    reasoning: `Mock: content flagged as ${category}`,
    redirectMessage:
      "Let's create something amazing together! How about drawing something that makes you happy?",
  };
}
