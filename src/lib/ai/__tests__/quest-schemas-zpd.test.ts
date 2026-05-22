import { describe, it, expect } from "vitest";
import {
  QuestGenerationInputSchema,
  MissionSchema,
} from "@/lib/ai/quest-schemas";

describe("ZPD-extended quest generation schemas (Session 2 seed)", () => {
  describe("QuestGenerationInputSchema", () => {
    it("accepts optional zpdScore in [0,1]", () => {
      const parsed = QuestGenerationInputSchema.parse({
        dream: "I want to build kites that fly higher than birds.",
        localContext:
          "Coastal village with bamboo, paper, and afternoon sea breeze.",
        zpdScore: 0.45,
      });
      expect(parsed.zpdScore).toBe(0.45);
    });

    it("accepts input without zpdScore (backward compatible)", () => {
      const parsed = QuestGenerationInputSchema.parse({
        dream: "Build a robot dog that fetches my slippers.",
        localContext: "Apartment with cardboard, tape, and toy motors.",
      });
      expect(parsed.zpdScore).toBeUndefined();
    });

    it("rejects zpdScore > 1", () => {
      expect(() =>
        QuestGenerationInputSchema.parse({
          dream: "Build a robot dog that fetches my slippers.",
          localContext: "Apartment with cardboard, tape, and toy motors.",
          zpdScore: 1.5,
        }),
      ).toThrow();
    });

    it("rejects zpdScore < 0", () => {
      expect(() =>
        QuestGenerationInputSchema.parse({
          dream: "Build a robot dog that fetches my slippers.",
          localContext: "Apartment with cardboard, tape, and toy motors.",
          zpdScore: -0.1,
        }),
      ).toThrow();
    });
  });

  describe("MissionSchema", () => {
    const baseMission = {
      day: 1,
      title: "Sketch the kite",
      description: "Draw your dream kite.",
      instructions: ["Find paper.", "Sketch the outline."],
      materials: ["Paper", "Pencil"],
      tips: ["Big ideas first."],
    };

    it("accepts optional phase/intensityHint/intent", () => {
      const parsed = MissionSchema.parse({
        ...baseMission,
        phase: "high",
        intensityHint: 0.45,
        intent: "stretch",
      });
      expect(parsed.phase).toBe("high");
      expect(parsed.intensityHint).toBe(0.45);
      expect(parsed.intent).toBe("stretch");
    });

    it("accepts mission without phase fields (backward compatible)", () => {
      const parsed = MissionSchema.parse(baseMission);
      expect(parsed.phase).toBeUndefined();
      expect(parsed.intensityHint).toBeUndefined();
      expect(parsed.intent).toBeUndefined();
    });

    it("rejects invalid phase value", () => {
      expect(() =>
        MissionSchema.parse({ ...baseMission, phase: "extreme" }),
      ).toThrow();
    });

    it("rejects intensityHint out of range", () => {
      expect(() =>
        MissionSchema.parse({ ...baseMission, intensityHint: 1.5 }),
      ).toThrow();
    });
  });
});
