import { describe, it, expect } from "vitest";
import { computeNextScore, BASE_STEP, OUTCOME_MULT } from "@/lib/zpd/update";

describe("computeNextScore", () => {
  describe("completion outcomes", () => {
    it("raises score on plain completion", () => {
      const next = computeNextScore(0.3, "completion", 7);
      expect(next).toBeGreaterThan(0.3);
    });

    it("raises more on completion_strong_reflection than plain completion", () => {
      const a = computeNextScore(0.3, "completion", 7);
      const b = computeNextScore(0.3, "completion_strong_reflection", 7);
      expect(b).toBeGreaterThan(a);
    });

    it("raises less on completion_with_frustration than plain completion", () => {
      const a = computeNextScore(0.3, "completion", 7);
      const b = computeNextScore(0.3, "completion_with_frustration", 7);
      expect(b).toBeLessThan(a);
      expect(b).toBeGreaterThan(0.3);
    });
  });

  describe("negative outcomes", () => {
    it("lowers score on abandoned", () => {
      const next = computeNextScore(0.5, "abandoned", 7);
      expect(next).toBeLessThan(0.5);
    });

    it("lowers score on frustration_sustained", () => {
      const next = computeNextScore(0.5, "frustration_sustained", 7);
      expect(next).toBeLessThan(0.5);
    });

    it("abandoned penalty stronger than frustration_sustained", () => {
      const a = computeNextScore(0.5, "abandoned", 7);
      const b = computeNextScore(0.5, "frustration_sustained", 7);
      expect(a).toBeLessThan(b);
    });
  });

  describe("recency weight", () => {
    it("weights same-day update strongest (>= 1.2x)", () => {
      const sameDay = computeNextScore(0.3, "completion", 0);
      const weekly = computeNextScore(0.3, "completion", 7);
      expect(sameDay - 0.3).toBeGreaterThan(weekly - 0.3);
    });

    it("dampens stale updates (>30 days)", () => {
      const recent = computeNextScore(0.3, "completion", 7);
      const stale = computeNextScore(0.3, "completion", 60);
      expect(stale - 0.3).toBeLessThan(recent - 0.3);
    });

    it("monotonically decreases delta as days increase across tiers", () => {
      const d1 = computeNextScore(0.3, "completion", 0) - 0.3;
      const d2 = computeNextScore(0.3, "completion", 5) - 0.3;
      const d3 = computeNextScore(0.3, "completion", 20) - 0.3;
      const d4 = computeNextScore(0.3, "completion", 60) - 0.3;
      expect(d1).toBeGreaterThanOrEqual(d2);
      expect(d2).toBeGreaterThanOrEqual(d3);
      expect(d3).toBeGreaterThanOrEqual(d4);
    });
  });

  describe("clamping", () => {
    it("clamps at 1.0 ceiling", () => {
      const next = computeNextScore(0.99, "completion_strong_reflection", 0);
      expect(next).toBeLessThanOrEqual(1);
    });

    it("clamps at 0.0 floor", () => {
      const next = computeNextScore(0.01, "abandoned", 0);
      expect(next).toBeGreaterThanOrEqual(0);
    });
  });

  describe("constants exported for inspection", () => {
    it("BASE_STEP positive and small", () => {
      expect(BASE_STEP).toBeGreaterThan(0);
      expect(BASE_STEP).toBeLessThan(0.1);
    });

    it("OUTCOME_MULT covers all outcome keys", () => {
      expect(OUTCOME_MULT.completion).toBeDefined();
      expect(OUTCOME_MULT.completion_strong_reflection).toBeDefined();
      expect(OUTCOME_MULT.completion_with_frustration).toBeDefined();
      expect(OUTCOME_MULT.abandoned).toBeDefined();
      expect(OUTCOME_MULT.frustration_sustained).toBeDefined();
    });
  });
});
