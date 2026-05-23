import type { AIProvider, ProviderModality } from "../types";
import { anthropicProvider } from "./anthropic";
import { googleProvider } from "./google";
import { grokProvider } from "./grok";
import { nvidiaProvider } from "./nvidia";
import { openaiProvider } from "./openai";
import { openrouterProvider } from "./openrouter";
import { vertexAiProvider } from "./vertex-ai";

const PROVIDERS: Record<string, AIProvider> = {
  anthropic: anthropicProvider,
  google: googleProvider,
  grok: grokProvider,
  nvidia: nvidiaProvider,
  openai: openaiProvider,
  openrouter: openrouterProvider,
  "vertex-ai": vertexAiProvider,
};

/**
 * Modality-specific env overrides:
 *   AI_PROVIDER_AUDIO=google   → google for audio artifact analysis
 *   AI_PROVIDER_IMAGE=openai   → openai for image artifact analysis
 *   AI_PROVIDER_MODERATION=openai
 *   AI_PROVIDER=openai         → default for all unset modalities
 *
 * Fallback chain: modality env → AI_PROVIDER env → "openai"
 * If resolved provider lacks the capability, auto-falls back to first
 * registered provider that declares it.
 */
const MODALITY_ENV: Record<ProviderModality | "moderation", string> = {
  audio: "AI_PROVIDER_AUDIO",
  image: "AI_PROVIDER_IMAGE",
  text: "AI_PROVIDER_TEXT",
  moderation: "AI_PROVIDER_MODERATION",
};

function resolveProviderName(modalityEnvKey: string): string {
  return process.env[modalityEnvKey] ?? process.env.AI_PROVIDER ?? "openai";
}

function getProviderByName(name: string): AIProvider {
  const provider = PROVIDERS[name];
  if (!provider) {
    throw new Error(
      `Unknown AI provider: "${name}". Valid: ${Object.keys(PROVIDERS).join(", ")}`,
    );
  }
  return provider;
}

function findCapableProvider(modality: ProviderModality): AIProvider | null {
  return Object.values(PROVIDERS).find((p) => p.capabilities?.has(modality)) ?? null;
}

function getProviderForCapability(name: string, modality: ProviderModality): AIProvider {
  const provider = getProviderByName(name);
  // No capabilities declared = legacy provider, assume it handles everything
  if (!provider.capabilities || provider.capabilities.has(modality)) return provider;

  const fallback = findCapableProvider(modality);
  if (fallback) {
    const fallbackName = Object.entries(PROVIDERS).find(([, p]) => p === fallback)?.[0];
    console.warn(
      `[AI] Provider "${name}" lacks "${modality}" capability — falling back to "${fallbackName}".`,
    );
    return fallback;
  }
  console.warn(
    `[AI] No provider with "${modality}" capability registered — using "${name}" as-is.`,
  );
  return provider;
}

/** General-purpose provider (text, quest, story, clustering). */
export function getProvider(): AIProvider {
  const name = resolveProviderName("AI_PROVIDER");
  console.log("[AI] Provider:", name);
  return getProviderByName(name);
}

/** Provider for image artifact analysis — respects AI_PROVIDER_IMAGE. */
export function getImageProvider(): AIProvider {
  const name = resolveProviderName(MODALITY_ENV.image);
  console.log("[AI] Image provider:", name);
  return getProviderForCapability(name, "image");
}

/** Provider for audio artifact analysis — respects AI_PROVIDER_AUDIO. */
export function getAudioProvider(): AIProvider {
  const name = resolveProviderName(MODALITY_ENV.audio);
  console.log("[AI] Audio provider:", name);
  return getProviderForCapability(name, "audio");
}

/** Provider for moderation tasks — respects AI_PROVIDER_MODERATION. */
export function getModerationProvider(): AIProvider {
  const name = resolveProviderName(MODALITY_ENV.moderation);
  console.log("[AI] Moderation provider:", name);
  return getProviderByName(name);
}
