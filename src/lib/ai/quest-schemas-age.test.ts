import { describe, expect, it } from "vitest";

import { MissionSchema, QuestGenerationInputSchema } from "./quest-schemas";

describe("MissionSchema — estimatedMinutes (age stratification M3)", () => {
  const baseValid = {
    day: 1,
    title: "Test",
    description: "Test mission description.",
    instructions: ["step 1"],
    materials: ["paper"],
    tips: ["tip 1"],
  };

  it("accepts payload with valid estimatedMinutes", () => {
    const result = MissionSchema.safeParse({ ...baseValid, estimatedMinutes: 15 });
    expect(result.success).toBe(true);
  });

  it("accepts payload without estimatedMinutes (optional)", () => {
    const result = MissionSchema.safeParse(baseValid);
    expect(result.success).toBe(true);
  });

  it("rejects estimatedMinutes ≤ 0", () => {
    const result = MissionSchema.safeParse({ ...baseValid, estimatedMinutes: 0 });
    expect(result.success).toBe(false);
  });

  it("rejects non-integer estimatedMinutes", () => {
    const result = MissionSchema.safeParse({ ...baseValid, estimatedMinutes: 12.5 });
    expect(result.success).toBe(false);
  });

  it("rejects estimatedMinutes > 60", () => {
    const result = MissionSchema.safeParse({ ...baseValid, estimatedMinutes: 61 });
    expect(result.success).toBe(false);
  });

  it("accepts estimatedMinutes at upper boundary 60", () => {
    const result = MissionSchema.safeParse({ ...baseValid, estimatedMinutes: 60 });
    expect(result.success).toBe(true);
  });
});

describe("QuestGenerationInputSchema — ageGroup (age stratification M3)", () => {
  const baseInput = {
    dream: "I want to be a robotics engineer",
    localContext: "I live in a rural village with limited materials",
  };

  it("accepts payload without ageGroup (optional, backward-compatible)", () => {
    const result = QuestGenerationInputSchema.safeParse(baseInput);
    expect(result.success).toBe(true);
  });

  it("accepts valid ageGroup values", () => {
    for (const band of ["3-6", "7-9", "10-12", "unknown"] as const) {
      const result = QuestGenerationInputSchema.safeParse({ ...baseInput, ageGroup: band });
      expect(result.success, `band ${band}`).toBe(true);
    }
  });

  it("rejects ageGroup outside the AgeGroup union", () => {
    const result = QuestGenerationInputSchema.safeParse({
      ...baseInput,
      ageGroup: "13-15",
    });
    expect(result.success).toBe(false);
  });
});
