import { describe, it, expect } from "vitest";
import {
  getTalentCategoryColor,
  TALENT_CATEGORY_COLORS,
  DEFAULT_PIN_COLOR,
} from "../gallery";

describe("Gallery Types", () => {
  describe("getTalentCategoryColor", () => {
    it("returns correct color for exact category match", () => {
      expect(getTalentCategoryColor("Engineering")).toBe("#3B82F6");
      expect(getTalentCategoryColor("Art")).toBe("#10B981");
      expect(getTalentCategoryColor("Narrative")).toBe("#8B5CF6");
      expect(getTalentCategoryColor("Creative")).toBe("#F59E0B");
    });

    it("returns correct color for category with locale suffix", () => {
      expect(getTalentCategoryColor("Engineering/Mekanika")).toBe("#3B82F6");
      expect(getTalentCategoryColor("Art/Seni Visual")).toBe("#10B981");
    });

    it("returns correct color for partial match", () => {
      expect(getTalentCategoryColor("Music/Rhythm")).toBe("#EC4899");
      expect(getTalentCategoryColor("Science/Physics")).toBe("#06B6D4");
    });

    it("returns default gray for unknown categories", () => {
      expect(getTalentCategoryColor("Unknown")).toBe(DEFAULT_PIN_COLOR);
      expect(getTalentCategoryColor("")).toBe(DEFAULT_PIN_COLOR);
    });

    it("has distinct colors for different categories", () => {
      const colors = Object.values(TALENT_CATEGORY_COLORS);
      const uniqueColors = new Set(colors);
      // Not all are unique (some have aliases), but core categories should be distinct
      expect(uniqueColors.size).toBeGreaterThanOrEqual(7);
    });
  });
});
