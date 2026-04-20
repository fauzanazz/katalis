/**
 * Frustration detection for the Quest Buddy mentor system.
 *
 * Uses rule-based signals:
 * - Message count in session (more messages without progress → higher frustration)
 * - Session duration (longer than expected → frustration)
 * - Negative keywords in child messages ("can't", "hard", "stuck", "confused", etc.)
 *
 * Returns a frustration level that determines the mentor's response strategy.
 */

import type { FrustrationLevel } from "../mentor-schemas";

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

const THRESHOLDS = {
  /** Child messages without completing mission */
  messageCountMedium: 6,
  messageCountHigh: 10,
  /** Session duration in minutes */
  durationMedium: 15,
  durationHigh: 30,
  /** Number of negative keywords to trigger */
  keywordCountMedium: 2,
  keywordCountHigh: 4,
} as const;

/**
 * Detect frustration level from session context.
 *
 * Strategy:
 * - none: Just started or making good progress
 * - low: Some signals but not concerning
 * - medium: Multiple signals — mentor should offer guided hints
 * - high: Strong signals — mentor should offer a "Small Adjustment"
 */
export function detectFrustration(
  context: FrustrationContext,
): FrustrationLevel {
  let score = 0;

  // Message count signal
  if (context.childMessageCount >= THRESHOLDS.messageCountHigh) {
    score += 3;
  } else if (context.childMessageCount >= THRESHOLDS.messageCountMedium) {
    score += 1;
  }

  // Duration signal
  if (context.sessionDurationMinutes >= THRESHOLDS.durationHigh) {
    score += 3;
  } else if (context.sessionDurationMinutes >= THRESHOLDS.durationMedium) {
    score += 1;
  }

  // Keyword signal
  const keywordHits = countNegativeKeywords(context.recentChildMessages);
  if (keywordHits >= THRESHOLDS.keywordCountHigh) {
    score += 3;
  } else if (keywordHits >= THRESHOLDS.keywordCountMedium) {
    score += 1;
  }

  // Map score to level
  if (score >= 5) return "high";
  if (score >= 3) return "medium";
  if (score >= 1) return "low";
  return "none";
}

function countNegativeKeywords(messages: string[]): number {
  const allText = messages.join(" ").toLowerCase();
  return FRUSTRATION_KEYWORDS.filter((kw) => allText.includes(kw)).length;
}
