/**
 * Text content moderation using the AI provider factory.
 */

import type { ModerationResult } from "./schemas";
import { getMockTextModeration } from "./mock/moderation";
import { getProvider } from "@/lib/ai/providers";

export async function moderateText(content: string): Promise<ModerationResult> {
  if (process.env.USE_MOCK_AI === "true") {
    return getMockTextModeration(content);
  }

  const provider = getProvider();
  return provider.moderateText(content);
}
