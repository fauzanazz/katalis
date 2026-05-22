import { describe, it, expect } from "vitest";
import { dayToPhase, phaseIntensityAnchor } from "@/lib/zpd/phases";

describe("dayToPhase", () => {
  it.each([
    [1, "high"],
    [2, "high"],
    [3, "medium"],
    [4, "medium"],
    [5, "medium"],
    [6, "low"],
    [7, "low"],
  ])("day %i maps to %s", (day, expected) => {
    expect(dayToPhase(day)).toBe(expected);
  });

  it("throws or clamps for out-of-range day", () => {
    // Defensive: day 0 and 8 should not silently return "low"
    expect(() => dayToPhase(0)).toThrow();
    expect(() => dayToPhase(8)).toThrow();
  });
});

describe("phaseIntensityAnchor", () => {
  it("adds +0.15 for high phase", () => {
    expect(phaseIntensityAnchor(0.3, "high")).toBeCloseTo(0.45, 5);
  });

  it("adds +0.05 for medium phase", () => {
    expect(phaseIntensityAnchor(0.3, "medium")).toBeCloseTo(0.35, 5);
  });

  it("subtracts 0.10 for low phase", () => {
    expect(phaseIntensityAnchor(0.3, "low")).toBeCloseTo(0.2, 5);
  });

  it("clamps high phase at 1.0 ceiling", () => {
    expect(phaseIntensityAnchor(0.95, "high")).toBe(1);
  });

  it("clamps low phase at 0.0 floor", () => {
    expect(phaseIntensityAnchor(0.05, "low")).toBe(0);
  });
});
