/**
 * Content moderation service for child safety.
 *
 * Provides a unified API for moderating text, images, and audio content.
 */

import { db } from "@/lib/db";
import { moderationEvents } from "@/lib/schema";
import type {
  ModerationInput,
  ModerationResult,
  ImageModerationInput,
  ContentType,
} from "./schemas";

export function redactChildUrl(url: string): string {
  const redacted = url.replace(/((?:child|guest)\/)[^/]+/, "$1[REDACTED]");
  if (redacted !== url) return redacted;
  return url.slice(0, 80);
}
import { moderateText } from "./moderate-text";
import { moderateImage } from "./moderate-image";

/**
 * Moderate content and persist the result.
 */
export async function moderateContent(
  input: ModerationInput,
): Promise<ModerationResult & { eventId: string }> {
  const result = await runModeration(input.content, input.contentType);

  const event = (
    await db
      .insert(moderationEvents)
      .values({
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        contentType: input.contentType,
        status: result.status,
        category: result.category,
        severity: result.severity,
        confidence: result.confidence,
        aiReasoning: result.reasoning,
        childId: input.childId,
        metadata: JSON.stringify({
          contentLength: input.content.length,
          contentType: input.contentType,
        }),
      })
      .returning()
  )[0];

  return { ...result, eventId: event.id };
}

/**
 * Moderate an image by URL and persist the result.
 */
export async function moderateImageContent(
  input: ImageModerationInput,
): Promise<ModerationResult & { eventId: string }> {
  console.log("[Moderation] Starting image moderation for:", redactChildUrl(input.imageUrl));
  const result = await moderateImage(input.imageUrl);
  console.log("[Moderation] Result:", { allowed: result.allowed, status: result.status });

  const event = (
    await db
      .insert(moderationEvents)
      .values({
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        contentType: "image",
        status: result.status,
        category: result.category,
        severity: result.severity,
        confidence: result.confidence,
        aiReasoning: result.reasoning,
        childId: input.childId,
        metadata: JSON.stringify({
          imageUrlLength: input.imageUrl.length,
        }),
      })
      .returning()
  )[0];

  return { ...result, eventId: event.id };
}

/**
 * Run the appropriate moderation check based on content type.
 */
async function runModeration(
  content: string,
  contentType: ContentType,
): Promise<ModerationResult> {
  switch (contentType) {
    case "text":
      return moderateText(content);
    case "image":
      return moderateImage(content);
    case "audio":
      return moderateText(content);
    default:
      return {
        allowed: false,
        status: "flagged",
        reasoning: `Unknown content type — content blocked pending review`,
      };
  }
}

// Re-export
export { getUncertaintyFallback } from "./policy";
export type { ModerationInput, ModerationResult, ImageModerationInput } from "./schemas";
export { ModerationInputSchema, ImageModerationInputSchema } from "./schemas";
