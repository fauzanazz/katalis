/**
 * Per-provider model tier resolution.
 *
 * Each provider keeps a base model used for everything by default. Two optional
 * tiers can be opted into per call site:
 *   - "smart"   → frontier model for high-reasoning tasks (mentor chat, quest gen)
 *   - "fast"    → cheap model for low-stakes tasks (clustering, summarization)
 *   - "default" → existing base model, unchanged
 *
 * Override via env vars; unset = use the base model, so behavior is identical
 * to today until an override is set.
 *
 * Envs:
 *   OPENAI_MODEL_SMART,     OPENAI_MODEL_FAST
 *   ANTHROPIC_MODEL_SMART,  ANTHROPIC_MODEL_FAST
 *   VERTEX_AI_MODEL_SMART,  VERTEX_AI_MODEL_FAST
 *   GOOGLE_AI_MODEL_SMART,  GOOGLE_AI_MODEL_FAST
 *   GROK_MODEL_SMART,       GROK_MODEL_FAST
 *   OPENROUTER_MODEL_SMART, OPENROUTER_MODEL_FAST
 *   NVIDIA_TEXT_MODEL_SMART, NVIDIA_TEXT_MODEL_FAST
 *   NVIDIA_VISION_MODEL_SMART, NVIDIA_VISION_MODEL_FAST
 */

export type ModelTier = "smart" | "fast" | "default";

const ENV_PREFIX = {
  openai: "OPENAI",
  anthropic: "ANTHROPIC",
  "vertex-ai": "VERTEX_AI",
  google: "GOOGLE_AI",
  grok: "GROK",
  openrouter: "OPENROUTER",
  "nvidia-text": "NVIDIA_TEXT",
  "nvidia-vision": "NVIDIA_VISION",
} as const;

export type ProviderKey = keyof typeof ENV_PREFIX;

export function resolveModel(
  provider: ProviderKey,
  tier: ModelTier,
  fallback: string,
): string {
  if (tier === "default") return fallback;
  const suffix = tier === "smart" ? "MODEL_SMART" : "MODEL_FAST";
  return process.env[`${ENV_PREFIX[provider]}_${suffix}`] ?? fallback;
}
