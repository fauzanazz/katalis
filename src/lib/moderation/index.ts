/**
 * Content moderation service for child safety.
 *
 * Provides a unified API for moderating text, images, and audio content.
 */

import { prisma } from "@/lib/db";
import type {
  ModerationInput,
  ModerationResult,
  ImageModerationInput,
  ContentType,
} from "./schemas";
import { moderateText } from "./moderate-text";
import { moderateImage } from "./moderate-image";

/**
 * Moderate content and persist the result.
 */
export async function moderateContent(
  input: ModerationInput,
): Promise<ModerationResult & { eventId: string }> {
  const result = await runModeration(input.content, input.contentType);

  const event = await prisma.moderationEvent.create({
    data: {
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
    },
  });

  return { ...result, eventId: event.id };
}

/**
 * Moderate an image by URL and persist the result.
 */
export async function moderateImageContent(
  input: ImageModerationInput,
): Promise<ModerationResult & { eventId: string }> {
  const result = await moderateImage(input.imageUrl);

  const event = await prisma.moderationEvent.create({
    data: {
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
    },
  });

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
        allowed: true,
        status: "flagged",
        reasoning: `Unknown content type: ${contentType}`,
      };
  }
}

// Re-export
export { getUncertaintyFallback } from "./policy";
export type { ModerationInput, ModerationResult, ImageModerationInput } from "./schemas";
export { ModerationInputSchema, ImageModerationInputSchema } from "./schemas";
