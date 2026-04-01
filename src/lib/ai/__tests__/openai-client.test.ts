import { describe, it, expect, beforeEach, afterEach } from "vitest";

import type { AnalysisInput } from "../schemas";

describe("analyzeArtifact", () => {
  const originalEnv = process.env.USE_MOCK_AI;

  beforeEach(() => {
    process.env.USE_MOCK_AI = "true";
  });

  afterEach(() => {
    process.env.USE_MOCK_AI = originalEnv;
  });

  it("returns mock response when USE_MOCK_AI=true for image", async () => {
    const { getMockMultimodalAnalysis } = await import(
      "../mock/multimodal-analysis"
    );

    const input: AnalysisInput = {
      artifactUrl: "http://localhost:3100/api/storage/images/test.jpg",
      artifactType: "image",
    };

    const result = await getMockMultimodalAnalysis(input.artifactType);

    expect(result).toBeDefined();
    expect(result.talents).toBeDefined();
    expect(result.talents.length).toBeGreaterThanOrEqual(2);
    result.talents.forEach((talent) => {
      expect(talent.name).toBeTruthy();
      expect(talent.confidence).toBeGreaterThanOrEqual(0);
      expect(talent.confidence).toBeLessThanOrEqual(1);
      expect(talent.reasoning).toBeTruthy();
      // Reasoning should be detailed (at least 50 chars)
      expect(talent.reasoning.length).toBeGreaterThan(50);
    });
  });

  it("returns narrative talents for audio artifacts", async () => {
    const { getMockMultimodalAnalysis } = await import(
      "../mock/multimodal-analysis"
    );

    const result = await getMockMultimodalAnalysis("audio");

    expect(result.talents).toBeDefined();
    expect(result.talents.length).toBeGreaterThanOrEqual(2);
    // Check that at least one talent is narrative-related
    const hasNarrative = result.talents.some(
      (t) =>
        t.name.toLowerCase().includes("storytelling") ||
        t.name.toLowerCase().includes("narrative") ||
        t.name.toLowerCase().includes("vocal"),
    );
    expect(hasNarrative).toBe(true);
  });

  it("validates mock response schema with Zod", async () => {
    const { AnalysisOutputSchema } = await import("../schemas");
    const { getMockMultimodalAnalysis } = await import(
      "../mock/multimodal-analysis"
    );

    const imageResult = await getMockMultimodalAnalysis("image");
    const audioResult = await getMockMultimodalAnalysis("audio");

    // Both should pass Zod validation
    expect(() => AnalysisOutputSchema.parse(imageResult)).not.toThrow();
    expect(() => AnalysisOutputSchema.parse(audioResult)).not.toThrow();
  });

  it("mock responses include reasoning beyond surface-level", async () => {
    const { mockVariants } = await import(
      "../mock/multimodal-analysis"
    );

    // Engineering mock should mention mechanical details, not just "art"
    const engTalent = mockVariants.engineering.talents[0];
    expect(engTalent.name).not.toBe("Art");
    expect(engTalent.reasoning.toLowerCase()).toMatch(
      /mechanical|joint|cable|engineer|structural/,
    );

    // Artistic mock should mention composition/color
    const artTalent = mockVariants.artistic.talents[0];
    expect(artTalent.reasoning.toLowerCase()).toMatch(
      /color|composition|visual|balance/,
    );

    // Narrative mock should mention storytelling patterns
    const narTalent = mockVariants.narrative.talents[0];
    expect(narTalent.reasoning.toLowerCase()).toMatch(
      /story|narrative|vocal|character/,
    );
  });

  it("has at least 3 distinct mock response variants", async () => {
    const { mockVariants } = await import(
      "../mock/multimodal-analysis"
    );

    const variantNames = Object.keys(mockVariants);
    expect(variantNames.length).toBeGreaterThanOrEqual(3);

    // Each variant should have unique talent names
    const allNames = new Set<string>();
    Object.values(mockVariants).forEach((variant) => {
      variant.talents.forEach((t) => allNames.add(t.name));
    });
    // Should have many unique talent names across variants
    expect(allNames.size).toBeGreaterThanOrEqual(6);
  });
});
