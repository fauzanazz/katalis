import { describe, it, expect } from "vitest";
import { TAG_CATEGORIES, isTagCategory } from "@/lib/ai/tag-schemas";

describe("tag-schemas TAG_CATEGORIES", () => {
  it("exposes exactly the 8 broad categories used by the classifier", () => {
    expect(TAG_CATEGORIES).toHaveLength(8);
    expect([...TAG_CATEGORIES]).toEqual([
      "Engineering",
      "Art",
      "Narrative",
      "Music",
      "Science",
      "Creative",
      "Leadership",
      "Empathy",
    ]);
  });

  it("isTagCategory accepts known labels and rejects unknown", () => {
    expect(isTagCategory("Engineering")).toBe(true);
    expect(isTagCategory("Empathy")).toBe(true);
    expect(isTagCategory("engineering")).toBe(false);
    expect(isTagCategory("")).toBe(false);
    expect(isTagCategory("Robotics")).toBe(false);
  });
});
