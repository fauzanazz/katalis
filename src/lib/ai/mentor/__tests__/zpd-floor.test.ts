import { describe, it, expect } from "vitest";
import { enforceZpdFloor } from "@/lib/ai/mentor/zpd-floor";
import { scoreToBand, bandRank } from "@/lib/zpd";

describe("enforceZpdFloor — Session 4 contract", () => {
  it("returns adjustment unchanged when its intensityHint is at or above the floor band", () => {
    const currentScore = 0.4; // developing
    const adjustment = { intensityHint: 0.5, copy: "simplify a bit" };
    const result = enforceZpdFloor(adjustment, currentScore);
    expect(result.allowed).toBe(true);
    expect(result.adjustment.intensityHint).toBe(0.5);
  });

  it("rejects adjustment whose intensityHint band is below current ZPD band", () => {
    const currentScore = 0.55; // proficient
    const adjustment = { intensityHint: 0.1, copy: "very easy" }; // emerging
    const result = enforceZpdFloor(adjustment, currentScore);
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/below.*floor|band/i);
  });

  it("treats same-band simplification as allowed (within band wiggle ok)", () => {
    const currentScore = 0.4; // developing (0.25..0.49)
    const adjustment = { intensityHint: 0.3, copy: "small simplification" };
    expect(enforceZpdFloor(adjustment, currentScore).allowed).toBe(true);
  });

  it("clamps adjustment to floor band when reject=false override is requested", () => {
    const currentScore = 0.55; // proficient
    const adjustment = { intensityHint: 0.1, copy: "emerging easy" };
    const result = enforceZpdFloor(adjustment, currentScore, {
      clampInsteadOfReject: true,
    });
    expect(result.allowed).toBe(true);
    expect(bandRank(scoreToBand(result.adjustment.intensityHint))).toBeGreaterThanOrEqual(
      bandRank(scoreToBand(currentScore)),
    );
  });
});
