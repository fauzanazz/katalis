/**
 * Image content moderation using the AI provider factory.
 */

import type { ModerationResult } from "./schemas";
import { getMockImageModeration } from "./mock/moderation";
import { getProvider } from "@/lib/ai/providers";
import { resolveImageToDataUrl } from "@/lib/storage/resolve-image";

export async function moderateImage(imageUrl: string): Promise<ModerationResult> {
  if (process.env.USE_MOCK_AI === "true") {
    return getMockImageModeration(imageUrl);
  }

  const resolved = await resolveImageToDataUrl(imageUrl);
  const provider = getProvider();
  return provider.moderateImage(resolved);
}
