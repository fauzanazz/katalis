/**
 * Moderation policy configuration for child-safe content filtering.
 *
 * Defines thresholds, redirect messages, and severity mappings
 * that control how the moderation system responds to flagged content.
 */

import type { HarmCategory, Severity } from "./schemas";

/** Policy action for a moderation result */
export type PolicyAction = "allow" | "block" | "flag_for_review" | "redirect";

/** A policy rule that maps a harm category to an action */
export interface PolicyRule {
  category: HarmCategory;
  action: PolicyAction;
  minSeverity: Severity;
  confidenceThreshold: number;
  redirectMessage: string;
}

/**
 * Age-safe moderation policy rules.
 */
const POLICY_RULES: PolicyRule[] = [
  {
    category: "violence",
    action: "block",
    minSeverity: "low",
    confidenceThreshold: 0.5,
    redirectMessage:
      "Let's create something amazing together! How about drawing something that makes you happy?",
  },
  {
    category: "self_harm",
    action: "block",
    minSeverity: "low",
    confidenceThreshold: 0.3,
    redirectMessage:
      "You matter and you're creative! Let's focus on something wonderful. How about a picture of your favorite place?",
  },
  {
    category: "sexual",
    action: "block",
    minSeverity: "low",
    confidenceThreshold: 0.3,
    redirectMessage:
      "Let's keep things fun and creative! Try drawing your favorite animal or a magical world.",
  },
  {
    category: "hate",
    action: "block",
    minSeverity: "low",
    confidenceThreshold: 0.4,
    redirectMessage:
      "Kindness is a superpower! Let's use your creativity for something positive. What makes you smile?",
  },
  {
    category: "harassment",
    action: "block",
    minSeverity: "low",
    confidenceThreshold: 0.5,
    redirectMessage:
      "Let's be kind to everyone! How about creating something that shows what friendship means to you?",
  },
  {
    category: "spam",
    action: "flag_for_review",
    minSeverity: "medium",
    confidenceThreshold: 0.6,
    redirectMessage: "",
  },
  {
    category: "other",
    action: "flag_for_review",
    minSeverity: "medium",
    confidenceThreshold: 0.7,
    redirectMessage: "",
  },
];

/**
 * Find the policy rule for a given harm category.
 */
export function getPolicyRule(category: HarmCategory): PolicyRule {
  return (
    POLICY_RULES.find((rule) => rule.category === category) ??
    POLICY_RULES[POLICY_RULES.length - 1]
  );
}

/**
 * Determine the action to take based on category, severity, and confidence.
 */
export function resolvePolicyAction(
  category: HarmCategory,
  severity: Severity,
  confidence: number,
): {
  action: PolicyAction;
  redirectMessage: string;
} {
  const rule = getPolicyRule(category);

  if (confidence < rule.confidenceThreshold) {
    return {
      action: "flag_for_review",
      redirectMessage: "",
    };
  }

  if (severity === "critical") {
    return {
      action: "block",
      redirectMessage: rule.redirectMessage,
    };
  }

  return {
    action: rule.action,
    redirectMessage: rule.redirectMessage,
  };
}

/**
 * Severity order: low < medium < high < critical
 */
const SEVERITY_ORDER: Record<Severity, number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};

export function meetsSeverityThreshold(
  severity: Severity,
  minimum: Severity,
): boolean {
  return SEVERITY_ORDER[severity] >= SEVERITY_ORDER[minimum];
}

/**
 * Encouraging fallback messages when AI analysis confidence is low.
 */
export const UNCERTAINTY_FALLBACKS = [
  "What an interesting creation! We see something special in your work. Let's explore more to discover your unique talents!",
  "Your creation has us curious! There's something unique here. Let's try another activity to learn even more about your amazing abilities!",
  "That's a creative piece of work! We'd love to see more of what you can do. Keep creating and exploring!",
  "What a wonderful imagination you have! Let's discover even more about your creative talents through fun activities!",
] as const;

/**
 * Get a random encouraging fallback message for uncertain AI results.
 */
export function getUncertaintyFallback(): string {
  return UNCERTAINTY_FALLBACKS[
    Math.floor(Math.random() * UNCERTAINTY_FALLBACKS.length)
  ];
}
