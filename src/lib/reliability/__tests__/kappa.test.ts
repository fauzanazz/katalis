import { describe, expect, it } from "vitest";
import {
  binaryKappa,
  confusionMatrix,
  macroKappaMultiLabel,
  topConfusedPairs,
} from "@/lib/reliability/kappa";
import type { RatingPair } from "@/lib/reliability/types";

/**
 * Reference values are hand-computed in the design doc and re-derived in comments
 * next to each test, so future readers can verify without external tooling.
 */

describe("binaryKappa", () => {
  it("returns null for empty observations", () => {
    expect(binaryKappa([])).toBeNull();
  });

  it("returns 1 for perfect positive agreement (degenerate marginal)", () => {
    // ai=[1,1,1,1] human=[1,1,1,1]  -> p_o=1, p_e=1  -> convention: 1.
    const observations = Array.from({ length: 4 }, () => ({ ai: true, human: true }));
    expect(binaryKappa(observations)).toBe(1);
  });

  it("returns 1 for perfect negative agreement (degenerate marginal)", () => {
    // ai=[0,0,0,0] human=[0,0,0,0]  -> p_o=1, p_e=1  -> convention: 1.
    const observations = Array.from({ length: 4 }, () => ({ ai: false, human: false }));
    expect(binaryKappa(observations)).toBe(1);
  });

  it("returns 0 for chance-level agreement", () => {
    // ai=[1,1,0,0] human=[1,0,1,0]: matches at 0,3 -> p_o=0.5
    // marginals: P(ai=1)=0.5, P(human=1)=0.5  -> p_e=0.5*0.5+0.5*0.5=0.5
    // kappa = (0.5-0.5)/(1-0.5) = 0
    const observations = [
      { ai: true, human: true },
      { ai: true, human: false },
      { ai: false, human: true },
      { ai: false, human: false },
    ];
    expect(binaryKappa(observations)).toBe(0);
  });

  it("returns -1 for perfect disagreement on balanced marginals", () => {
    // ai=[1,1,0,0] human=[0,0,1,1]: matches=0 -> p_o=0
    // marginals: 0.5 each  -> p_e=0.5
    // kappa = (0-0.5)/(1-0.5) = -1
    const observations = [
      { ai: true, human: false },
      { ai: true, human: false },
      { ai: false, human: true },
      { ai: false, human: true },
    ];
    expect(binaryKappa(observations)).toBe(-1);
  });

  it("matches a worked example with substantial agreement", () => {
    // 10 items: ai=[1,1,1,1,0,0,0,0,0,0] human=[1,1,1,0,0,0,0,0,0,1]
    // matches at 0,1,2,4,5,6,7,8 -> p_o = 8/10 = 0.8
    // P(ai=1)=0.4, P(human=1)=0.4 -> p_e = 0.4*0.4 + 0.6*0.6 = 0.52
    // kappa = (0.8-0.52)/(1-0.52) = 0.5833...
    const aiSide = [1, 1, 1, 1, 0, 0, 0, 0, 0, 0];
    const humanSide = [1, 1, 1, 0, 0, 0, 0, 0, 0, 1];
    const observations = aiSide.map((a, i) => ({
      ai: a === 1,
      human: humanSide[i] === 1,
    }));
    const k = binaryKappa(observations);
    expect(k).not.toBeNull();
    expect(k!).toBeCloseTo(0.5833333, 5);
  });

  it("returns 0 when one side is constant and the other varies (no possible information)", () => {
    // ai always true, human varies. p_e = 1*marginalHuman + 0 = marginalHuman = p_o.
    // (p_o - p_e)/(1 - p_e) = 0 / (1 - p_e) = 0 unless p_e = 1.
    const observations = [
      { ai: true, human: true },
      { ai: true, human: false },
      { ai: true, human: true },
      { ai: true, human: false },
    ];
    expect(binaryKappa(observations)).toBe(0);
  });
});

describe("confusionMatrix", () => {
  it("counts tp/fp/fn/tn correctly across multiple labels", () => {
    // domain = [A, B, C]
    // item 1: ai={A,B}, human={A}
    // item 2: ai={B,C}, human={B,C}
    const items: RatingPair[] = [
      { aiLabels: new Set(["A", "B"]), humanLabels: new Set(["A"]) },
      { aiLabels: new Set(["B", "C"]), humanLabels: new Set(["B", "C"]) },
    ];
    const matrix = confusionMatrix(["A", "B", "C"], items);

    // A: item1 ai=1,human=1 -> tp ; item2 ai=0,human=0 -> tn
    expect(matrix.A).toEqual({
      truePositive: 1,
      falsePositive: 0,
      falseNegative: 0,
      trueNegative: 1,
    });
    // B: item1 ai=1,human=0 -> fp ; item2 ai=1,human=1 -> tp
    expect(matrix.B).toEqual({
      truePositive: 1,
      falsePositive: 1,
      falseNegative: 0,
      trueNegative: 0,
    });
    // C: item1 ai=0,human=0 -> tn ; item2 ai=1,human=1 -> tp
    expect(matrix.C).toEqual({
      truePositive: 1,
      falsePositive: 0,
      falseNegative: 0,
      trueNegative: 1,
    });
  });
});

describe("macroKappaMultiLabel", () => {
  it("returns null kappa for empty input", () => {
    const result = macroKappaMultiLabel(["A", "B"], []);
    expect(result.kappa).toBeNull();
    expect(result.sampleSize).toBe(0);
    expect(result.perLabel).toEqual([]);
  });

  it("computes macro kappa over the design's worked example", () => {
    // From design §6 worked example:
    // domain=[A,B,C], items as above. Per-label kappa: A=1, B=0, C=1.
    // Macro over non-skipped labels: (1+0+1)/3 = 0.6666...
    const items: RatingPair[] = [
      { aiLabels: new Set(["A", "B"]), humanLabels: new Set(["A"]) },
      { aiLabels: new Set(["B", "C"]), humanLabels: new Set(["B", "C"]) },
    ];
    const result = macroKappaMultiLabel(["A", "B", "C"], items);

    expect(result.sampleSize).toBe(2);
    expect(result.kappa).not.toBeNull();
    expect(result.kappa!).toBeCloseTo(0.6666666, 5);
    expect(result.skipped).toEqual([]);
    const kappaByLabel = Object.fromEntries(
      result.perLabel.map((p) => [p.label, p.kappa]),
    );
    expect(kappaByLabel.A).toBe(1);
    expect(kappaByLabel.B).toBe(0);
    expect(kappaByLabel.C).toBe(1);
  });

  it("skips labels with zero positive observations on both sides by default", () => {
    // Z is never selected by either side and should be skipped.
    const items: RatingPair[] = [
      { aiLabels: new Set(["A"]), humanLabels: new Set(["A"]) },
      { aiLabels: new Set(["A"]), humanLabels: new Set(["A"]) },
    ];
    const result = macroKappaMultiLabel(["A", "Z"], items);
    expect(result.skipped).toContain("Z");
    expect(result.perLabel.map((p) => p.label)).not.toContain("Z");
    expect(result.kappa).toBe(1);
  });

  it("includes never-observed labels with kappa=0 in strict mode", () => {
    const items: RatingPair[] = [
      { aiLabels: new Set(["A"]), humanLabels: new Set(["A"]) },
      { aiLabels: new Set(["A"]), humanLabels: new Set(["A"]) },
    ];
    const result = macroKappaMultiLabel(["A", "Z"], items, { strict: true });
    expect(result.skipped).toEqual([]);
    const z = result.perLabel.find((p) => p.label === "Z");
    expect(z?.kappa).toBe(0);
    expect(result.kappa).toBe(0.5);
  });
});

describe("topConfusedPairs", () => {
  it("returns pairs (aiLabel, humanLabel) ranked by count", () => {
    // ai-only labels per item paired with human-only labels per item.
    // item1: ai={A}, human={B} -> (A,B)
    // item2: ai={A}, human={B} -> (A,B)
    // item3: ai={C}, human={B} -> (C,B)
    const items: RatingPair[] = [
      { aiLabels: new Set(["A"]), humanLabels: new Set(["B"]) },
      { aiLabels: new Set(["A"]), humanLabels: new Set(["B"]) },
      { aiLabels: new Set(["C"]), humanLabels: new Set(["B"]) },
    ];
    const pairs = topConfusedPairs(items, 5);
    expect(pairs[0]).toEqual({ aiLabel: "A", humanLabel: "B", count: 2 });
    expect(pairs[1]).toEqual({ aiLabel: "C", humanLabel: "B", count: 1 });
  });

  it("truncates to N pairs", () => {
    const items: RatingPair[] = [
      { aiLabels: new Set(["A"]), humanLabels: new Set(["B"]) },
      { aiLabels: new Set(["A"]), humanLabels: new Set(["C"]) },
      { aiLabels: new Set(["A"]), humanLabels: new Set(["D"]) },
    ];
    expect(topConfusedPairs(items, 2)).toHaveLength(2);
  });
});
