/**
 * Frustration detection for the Quest Buddy mentor system.
 *
 * Uses rule-based signals:
 * - Message count in session (more messages without progress → higher frustration)
 * - Session duration (longer than expected → frustration)
 * - Negative keywords in child messages ("can't", "hard", "stuck", "confused", etc.)
 *
 * Thresholds vary by `AgeGroup` (see `age-config.ts`). Younger bands trigger
 * frustration sooner; older bands tolerate more turns before escalating.
 */

import type { AgeGroup } from "@/lib/age";

import type { FrustrationLevel } from "../mentor-schemas";
import { getFrustrationThresholds } from "./age-config";

/** Negative keywords that signal frustration (case-insensitive) */
const FRUSTRATION_KEYWORDS = [
  "can't", "cant", "cannot", "don't know", "dont know",
  "hard", "difficult", "stuck", "confused", "help",
  "boring", "hate", "give up", "too hard", "impossible",
  "tidak bisa", "sulit", "bingung", "bosan", // Indonesian
  "不会", "太难", "不懂", "无聊", // Chinese
];

interface FrustrationContext {
  messageCount: number;
  childMessageCount: number;
  sessionDurationMinutes: number;
  recentChildMessages: string[];
}

/**
 * Detect frustration level from session context.
 *
 * Strategy:
 * - none: Just started or making good progress
 * - low: Some signals but not concerning
 * - medium: Multiple signals — mentor should offer guided hints
 * - high: Strong signals — mentor should offer a "Small Adjustment"
 *
 * `ageGroup` selects per-band thresholds (younger → stricter). Defaults to
 * `unknown` (= 7-9 baseline) for backward compatibility with callers that
 * haven't been threaded through yet.
 */
export function detectFrustration(
  context: FrustrationContext,
  ageGroup: AgeGroup | null | undefined = "unknown",
): FrustrationLevel {
  const thresholds = getFrustrationThresholds(ageGroup);
  let score = 0;

  if (context.childMessageCount >= thresholds.messageCountHigh) {
    score += 3;
  } else if (context.childMessageCount >= thresholds.messageCountMedium) {
    score += 1;
  }

  if (context.sessionDurationMinutes >= thresholds.durationHigh) {
    score += 3;
  } else if (context.sessionDurationMinutes >= thresholds.durationMedium) {
    score += 1;
  }

  const keywordHits = countNegativeKeywords(context.recentChildMessages);
  if (keywordHits >= thresholds.keywordCountHigh) {
    score += 3;
  } else if (keywordHits >= thresholds.keywordCountMedium) {
    score += 1;
  }

  if (score >= 5) return "high";
  if (score >= 3) return "medium";
  if (score >= 1) return "low";
  return "none";
}

function countNegativeKeywords(messages: string[]): number {
  const allText = messages.join(" ").toLowerCase();
  return FRUSTRATION_KEYWORDS.filter((kw) => allText.includes(kw)).length;
}
