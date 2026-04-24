import type { AIProvider } from "../types";

export function getProvider(): AIProvider {
  const provider = process.env.AI_PROVIDER ?? "openai";
  console.log("[AI] Provider:", provider);

  if (provider === "anthropic") {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("./anthropic").anthropicProvider as AIProvider;
  }

  if (provider === "nvidia") {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("./nvidia").nvidiaProvider as AIProvider;
  }

  if (provider === "openrouter") {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("./openrouter").openrouterProvider as AIProvider;
  }

  if (provider === "google") {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("./google").googleProvider as AIProvider;
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("./openai").openaiProvider as AIProvider;
}
