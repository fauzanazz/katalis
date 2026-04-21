import type { AIProvider } from "../types";

export function getProvider(): AIProvider {
  const provider = process.env.AI_PROVIDER ?? "openai";

  if (provider === "anthropic") {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("./anthropic").anthropicProvider as AIProvider;
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("./openai").openaiProvider as AIProvider;
}
