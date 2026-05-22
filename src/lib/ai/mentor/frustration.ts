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

export interface FrustrationContext {
  messageCount: number;
  childMessageCount: number;
  sessionDurationMinutes: number;
  recentChildMessages: string[];
  /** Minutes since last child input (client sends lastInputAt, route computes gap) */
  inactivityMinutes?: number;
  /** Delete/redo counts from quest editor hook */
  editEvents?: { deletes: number; redos: number };
  /**
   * Voice prosody signals when the child spoke instead of typed. Computed
   * from the audio sample on the client (or post-transcription on server).
   * Spec ref: Katalis.docx §4.1 multi-signal fusion.
   */
  voiceProsody?: {
    /** Pitch drop ratio vs. child baseline (0-1). ≥0.3 elevated. */
    pitchDropRatio?: number;
    /** Speaking rate in WPM. Children typical 80-130; ≤60 elevated. */
    speechRateWpm?: number;
    /** Silence fraction in the speech window (0-1). ≥0.4 elevated. */
    pauseRatioPct?: number;
  };
  /** True when soft check-in already sent; next medium/high → offer adjustment */
  pendingCheckin?: boolean;
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

  if (context.inactivityMinutes !== undefined) {
    if (context.inactivityMinutes >= 10) {
      score += 4;
    } else if (context.inactivityMinutes >= 5) {
      score += 2;
    }
  }

  if (context.editEvents) {
    const edits = context.editEvents.deletes + context.editEvents.redos;
    if (edits >= 6) {
      score += 2;
    } else if (edits >= 3) {
      score += 1;
    }
  }

  if (context.voiceProsody) {
    score += scoreProsody(context.voiceProsody);
  }

  if (score >= 5) return "high";
  if (score >= 3) return "medium";
  if (score >= 1) return "low";
  return "none";
}

/**
 * Determine soft-intervention action given frustration level and check-in state.
 * Returns null when no intervention needed.
 *
 * State machine:
 *   medium/high + !pendingCheckin → "checkin" (ask "how are you feeling?")
 *   medium/high + pendingCheckin  → "adjustment" (offer Small Adjustment)
 *   none/low                      → null
 */
export function resolveCheckinAction(
  level: FrustrationLevel,
  pendingCheckin: boolean,
): "checkin" | "adjustment" | null {
  if (level === "none" || level === "low") return null;
  if (pendingCheckin) return "adjustment";
  return "checkin";
}

/**
 * Downgrade frustration level passed to mentorChat during a soft check-in.
 * "checkin" action → pass "low" so the mentor asks how the child feels, not
 * immediately offers a Small Adjustment.
 */
export function applyCheckinOverride(
  level: FrustrationLevel,
  action: "checkin" | "adjustment" | null,
): FrustrationLevel {
  return action === "checkin" ? "low" : level;
}

function countNegativeKeywords(messages: string[]): number {
  const allText = messages.join(" ").toLowerCase();
  return FRUSTRATION_KEYWORDS.filter((kw) => allText.includes(kw)).length;
}

/**
 * Score voice prosody features. Each elevated feature adds 1 point; very
 * extreme readings add 2. Caps the total at 4 so prosody alone cannot pin
 * a session at "high" without any other signal.
 */
function scoreProsody(prosody: NonNullable<FrustrationContext["voiceProsody"]>): number {
  let score = 0;

  if (typeof prosody.pitchDropRatio === "number") {
    if (prosody.pitchDropRatio >= 0.5) score += 2;
    else if (prosody.pitchDropRatio >= 0.3) score += 1;
  }

  if (typeof prosody.speechRateWpm === "number") {
    if (prosody.speechRateWpm > 0 && prosody.speechRateWpm <= 40) score += 2;
    else if (prosody.speechRateWpm > 0 && prosody.speechRateWpm <= 60) score += 1;
  }

  if (typeof prosody.pauseRatioPct === "number") {
    if (prosody.pauseRatioPct >= 0.6) score += 2;
    else if (prosody.pauseRatioPct >= 0.4) score += 1;
  }

  return Math.min(score, 4);
}
