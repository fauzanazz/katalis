import { describe, it, expect } from "vitest";
import { buildZpdPromptBlock, fillPhaseMetadata } from "@/lib/ai/zpd-prompt";
import type { QuestGenerationOutput } from "@/lib/ai/quest-schemas";

describe("buildZpdPromptBlock", () => {
  it("references all 7 days", () => {
    const block = buildZpdPromptBlock(0.3);
    for (let day = 1; day <= 7; day++) {
      expect(block).toContain(`Day ${day}`);
    }
  });

  it("uses default baseline (0.30) when no score given", () => {
    const block = buildZpdPromptBlock();
    expect(block).toContain("0.30");
  });

  it("marks day 1-2 as high phase", () => {
    const block = buildZpdPromptBlock(0.4);
    expect(block).toMatch(/Day 1[^\n]*phase=high/);
    expect(block).toMatch(/Day 2[^\n]*phase=high/);
  });

  it("marks day 3-5 as medium phase", () => {
    const block = buildZpdPromptBlock(0.4);
    expect(block).toMatch(/Day 3[^\n]*phase=medium/);
    expect(block).toMatch(/Day 4[^\n]*phase=medium/);
    expect(block).toMatch(/Day 5[^\n]*phase=medium/);
  });

  it("marks day 6-7 as low phase", () => {
    const block = buildZpdPromptBlock(0.4);
    expect(block).toMatch(/Day 6[^\n]*phase=low/);
    expect(block).toMatch(/Day 7[^\n]*phase=low/);
  });
});

describe("fillPhaseMetadata", () => {
  function baseMissions(): QuestGenerationOutput {
    return {
      missions: Array.from({ length: 7 }, (_, i) => ({
        day: i + 1,
        title: `Day ${i + 1} mission`,
        description: "desc",
        instructions: ["step"],
        materials: ["mat"],
        tips: ["tip"],
      })),
    };
  }

  it("backfills phase for all missions when missing", () => {
    const out = fillPhaseMetadata(baseMissions(), 0.3);
    expect(out.missions.map((m) => m.phase)).toEqual([
      "high",
      "high",
      "medium",
      "medium",
      "medium",
      "low",
      "low",
    ]);
  });

  it("backfills intensityHint matching phase + score", () => {
    const out = fillPhaseMetadata(baseMissions(), 0.3);
    expect(out.missions[0].intensityHint).toBeCloseTo(0.45, 5);
    expect(out.missions[2].intensityHint).toBeCloseTo(0.35, 5);
    expect(out.missions[5].intensityHint).toBeCloseTo(0.2, 5);
  });

  it("backfills intent matching phase", () => {
    const out = fillPhaseMetadata(baseMissions(), 0.3);
    expect(out.missions[0].intent).toBe("stretch");
    expect(out.missions[3].intent).toBe("stabilize");
    expect(out.missions[6].intent).toBe("consolidate");
  });

  it("preserves provider-supplied phase/intensityHint/intent", () => {
    const provided: QuestGenerationOutput = {
      missions: baseMissions().missions.map((m) =>
        m.day === 1
          ? {
              ...m,
              phase: "medium" as const,
              intensityHint: 0.5,
              intent: "warm-up",
            }
          : m,
      ),
    };
    const out = fillPhaseMetadata(provided, 0.3);
    expect(out.missions[0].phase).toBe("medium");
    expect(out.missions[0].intensityHint).toBe(0.5);
    expect(out.missions[0].intent).toBe("warm-up");
  });

  it("uses default baseline 0.30 when no score given", () => {
    const out = fillPhaseMetadata(baseMissions());
    expect(out.missions[0].intensityHint).toBeCloseTo(0.45, 5);
  });

  it("produces monotonic non-increasing intensityHint across days", () => {
    const out = fillPhaseMetadata(baseMissions(), 0.3);
    const hints = out.missions.map((m) => m.intensityHint!);
    for (let i = 1; i < hints.length; i++) {
      expect(hints[i]).toBeLessThanOrEqual(hints[i - 1]);
    }
  });
});
