import { describe, it, expect, beforeEach, afterEach } from "vitest";

describe("Story Analysis Mock", () => {
  const originalEnv = process.env.USE_MOCK_AI;

  beforeEach(() => {
    process.env.USE_MOCK_AI = "true";
  });

  afterEach(() => {
    process.env.USE_MOCK_AI = originalEnv;
  });

  it("returns mock response for text story submission", async () => {
    const { getMockStoryAnalysis } = await import(
      "../mock/story-analysis"
    );

    const result = await getMockStoryAnalysis("text");

    expect(result).toBeDefined();
    expect(result.talents).toBeDefined();
    expect(result.talents.length).toBeGreaterThanOrEqual(2);
    result.talents.forEach((talent) => {
      expect(talent.name).toBeTruthy();
      expect(talent.confidence).toBeGreaterThanOrEqual(0);
      expect(talent.confidence).toBeLessThanOrEqual(1);
      expect(talent.reasoning).toBeTruthy();
      expect(talent.reasoning.length).toBeGreaterThan(50);
    });
  });

  it("returns empathetic narrator response for audio story", async () => {
    const { getMockStoryAnalysis } = await import(
      "../mock/story-analysis"
    );

    const result = await getMockStoryAnalysis("audio");

    expect(result.talents).toBeDefined();
    expect(result.talents.length).toBeGreaterThanOrEqual(2);
    // Audio should return empathetic narrator variant
    const hasEmpathy = result.talents.some(
      (t) =>
        t.name.toLowerCase().includes("empathy") ||
        t.name.toLowerCase().includes("emotional") ||
        t.name.toLowerCase().includes("social"),
    );
    expect(hasEmpathy).toBe(true);
  });

  it("validates mock response schema with Zod", async () => {
    const { AnalysisOutputSchema } = await import("../schemas");
    const { getMockStoryAnalysis } = await import(
      "../mock/story-analysis"
    );

    const textResult = await getMockStoryAnalysis("text");
    const audioResult = await getMockStoryAnalysis("audio");

    expect(() => AnalysisOutputSchema.parse(textResult)).not.toThrow();
    expect(() => AnalysisOutputSchema.parse(audioResult)).not.toThrow();
  });

  it("has at least 4 distinct mock response variants", async () => {
    const { storyMockVariants } = await import(
      "../mock/story-analysis"
    );

    const variantNames = Object.keys(storyMockVariants);
    expect(variantNames.length).toBeGreaterThanOrEqual(4);

    // Each variant should have unique talent names
    const allNames = new Set<string>();
    Object.values(storyMockVariants).forEach((variant) => {
      variant.talents.forEach((t) => allNames.add(t.name));
    });
    expect(allNames.size).toBeGreaterThanOrEqual(8);
  });

  it("mock responses reference narrative patterns", async () => {
    const { storyMockVariants } = await import(
      "../mock/story-analysis"
    );

    // Logical variant should reference reasoning/cause-effect
    const logicalTalent = storyMockVariants.logical.talents[0];
    expect(logicalTalent.reasoning.toLowerCase()).toMatch(
      /cause|effect|logic|reason|problem|solution|step/,
    );

    // Creative variant should reference imagination/fantasy
    const creativeTalent = storyMockVariants.creative.talents[0];
    expect(creativeTalent.reasoning.toLowerCase()).toMatch(
      /imagin|fantasy|creative|invent|magic|transform/,
    );

    // Empathetic variant should reference feelings/emotions
    const empatheticTalent = storyMockVariants.empathetic.talents[0];
    expect(empatheticTalent.reasoning.toLowerCase()).toMatch(
      /feel|emotion|empathy|perspective|care|alone/,
    );

    // Scientific variant should reference observation/curiosity
    const scientificTalent = storyMockVariants.scientific.talents[0];
    expect(scientificTalent.reasoning.toLowerCase()).toMatch(
      /observ|curios|scienti|physical|nature|cause/,
    );
  });
});
