/**
 * Shared utility for mapping raw AI moderation responses to ModerationResult.
 * Validates AI output with Zod to prevent hallucinated categories/severities.
 */

import { z } from "zod";
import { HarmCategorySchema, SeveritySchema } from "./schemas";
import type { ModerationResult } from "./schemas";
import { resolvePolicyAction } from "./policy";

/** Zod schema for validating AI moderation response JSON */
const AiModerationResponseSchema = z.object({
  isHarmful: z.boolean(),
  category: HarmCategorySchema.nullable(),
  severity: SeveritySchema.nullable(),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
});

/**
 * Map a raw parsed AI response to a ModerationResult.
 * Validates the response with Zod before processing.
 * Falls back to safe defaults on invalid data.
 */
export function mapToModerationResult(raw: unknown): ModerationResult {
  const validated = AiModerationResponseSchema.safeParse(raw);

  if (!validated.success) {
    // AI returned unexpected shape — flag for human review
    return {
      allowed: true,
      status: "flagged",
      category: undefined,
      severity: undefined,
      confidence: 0,
      reasoning: "AI moderation response was invalid, flagged for review",
    };
  }

  const { isHarmful, category, severity, confidence, reasoning } = validated.data;

  if (!isHarmful) {
    return {
      allowed: true,
      status: "approved",
      confidence,
      reasoning,
    };
  }

  const safeCategory = category ?? "other";
  const safeSeverity = severity ?? "medium";

  const { action, redirectMessage } = resolvePolicyAction(
    safeCategory,
    safeSeverity,
    confidence,
  );

  if (action === "block") {
    return {
      allowed: false,
      status: "blocked",
      category: safeCategory,
      severity: safeSeverity,
      confidence,
      reasoning,
      redirectMessage,
    };
  }

  if (action === "redirect") {
    return {
      allowed: false,
      status: "redirected",
      category: safeCategory,
      severity: safeSeverity,
      confidence,
      reasoning,
      redirectMessage,
    };
  }

  return {
    allowed: true,
    status: "flagged",
    category: safeCategory,
    severity: safeSeverity,
    confidence,
    reasoning,
  };
}
