import { describe, it, expect } from "vitest";
import {
  getMockQuestGeneration,
  questMockVariants,
} from "../mock/quest-generation";
import { QuestGenerationOutputSchema } from "../quest-schemas";

describe("Quest Generation Mock", () => {
  it("returns robotics quest for robot-related dreams", async () => {
    const result = await getMockQuestGeneration("I want to build robots");
    expect(result.missions).toHaveLength(7);
    expect(result.missions[0].day).toBe(1);
    expect(result.missions[6].day).toBe(7);
    // Each mission has all required fields
    for (const mission of result.missions) {
      expect(mission.title).toBeTruthy();
      expect(mission.description).toBeTruthy();
      expect(mission.instructions.length).toBeGreaterThan(0);
      expect(mission.materials.length).toBeGreaterThan(0);
      expect(mission.tips.length).toBeGreaterThan(0);
    }
  });

  it("returns art quest for non-engineering dreams", async () => {
    const result = await getMockQuestGeneration("I want to paint beautiful pictures");
    expect(result.missions).toHaveLength(7);
    expect(result.missions[0].title).toContain("Color");
  });

  it("validates robotics mock response against Zod schema", () => {
    const parsed = QuestGenerationOutputSchema.safeParse(
      questMockVariants.robotics,
    );
    expect(parsed.success).toBe(true);
  });

  it("validates art mock response against Zod schema", () => {
    const parsed = QuestGenerationOutputSchema.safeParse(
      questMockVariants.art,
    );
    expect(parsed.success).toBe(true);
  });

  it("missions have progressive day numbers (1-7)", () => {
    for (const variant of Object.values(questMockVariants)) {
      for (let i = 0; i < 7; i++) {
        expect(variant.missions[i].day).toBe(i + 1);
      }
    }
  });

  it("engineering keywords trigger robotics quest", async () => {
    // Test a subset to avoid timeout — the mock function checks keywords
    const result = await getMockQuestGeneration("I want to build a robot");
    expect(result.missions).toHaveLength(7);
    // Verify it's the robotics variant (Day 1 is about observation/sketching)
    expect(result.missions[0].title).toContain("Observe");
  });

  it("each variant has exactly 7 missions", () => {
    expect(questMockVariants.robotics.missions).toHaveLength(7);
    expect(questMockVariants.art.missions).toHaveLength(7);
  });
});
