import type { AIProvider } from "../types";
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

export function getProvider(): AIProvider {
  const name = process.env.AI_PROVIDER ?? "openai";
  console.log("[AI] Provider:", name);
  const provider = PROVIDERS[name];
  if (!provider) throw new Error(`Unknown AI provider: "${name}". Valid: ${Object.keys(PROVIDERS).join(", ")}`);
  return provider;
}
