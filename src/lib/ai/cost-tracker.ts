// USD per 1M tokens — update as pricing changes
const PRICING: Record<string, { input: number; output: number }> = {
  "gemini-2.5-flash":         { input: 0.30,  output: 2.50 },
  "gemini-2.5-flash-lite":    { input: 0.10,  output: 0.40 },
  "gemini-2.0-flash":         { input: 0.10,  output: 0.40 },
  "gemini-2.0-flash-lite":    { input: 0.075, output: 0.30 },
  "gemini-1.5-flash":         { input: 0.075, output: 0.30 },
  "gemini-1.5-flash-8b":      { input: 0.0375, output: 0.15 },
  "gemini-1.5-pro":           { input: 1.25,  output: 5.00 },
  "gpt-4o":                   { input: 2.50,  output: 10.00 },
  "gpt-4o-mini":              { input: 0.15,  output: 0.60 },
  "claude-3-5-haiku-20251022":{ input: 0.80,  output: 4.00 },
  "claude-3-5-sonnet-20241022":{ input: 3.00, output: 15.00 },
};

function calcCost(model: string, inputTokens: number, outputTokens: number): number {
  const p = PRICING[model] ?? { input: 0, output: 0 };
  return (inputTokens * p.input + outputTokens * p.output) / 1_000_000;
}

export async function trackUsage(params: {
  provider: string;
  model: string;
  operation: string;
  inputTokens: number;
  outputTokens: number;
}): Promise<void> {
  const costUsd = calcCost(params.model, params.inputTokens, params.outputTokens);

  // No DB persistence yet — AiUsageLog model not in schema. Log-only for now.
  console.log(
    `[AI Cost] ${params.provider}/${params.model} ${params.operation}` +
    ` in:${params.inputTokens} out:${params.outputTokens}` +
    ` $${costUsd.toFixed(6)}`,
  );
}
