import { describe, it, expect } from "vitest";
import { mapDiscoveryAnalysisToInterestSignals } from "./discovery-mapper";

describe("mapDiscoveryAnalysisToInterestSignals", () => {
  it("returns empty array for null input", () => {
    expect(mapDiscoveryAnalysisToInterestSignals(null)).toEqual([]);
  });

  it("returns empty array for non-object input", () => {
    expect(mapDiscoveryAnalysisToInterestSignals("string")).toEqual([]);
    expect(mapDiscoveryAnalysisToInterestSignals(42)).toEqual([]);
  });

  it("returns empty array for object with no talents", () => {
    expect(mapDiscoveryAnalysisToInterestSignals({})).toEqual([]);
  });

  it("maps science keyword in talent name to science interest", () => {
    const result = mapDiscoveryAnalysisToInterestSignals({
      talents: [{ name: "Science Explorer", confidence: 0.8, reasoning: "Likes experiments" }],
    });
    const keys = result.map((s) => s.interestKey);
    expect(keys).toContain("science");
  });

  it("maps animal keyword in reasoning to animals interest", () => {
    const result = mapDiscoveryAnalysisToInterestSignals({
      talents: [{ name: "Nature Lover", confidence: 0.7, reasoning: "Loves drawing animals" }],
    });
    const keys = result.map((s) => s.interestKey);
    expect(keys).toContain("animals");
  });

  it("maps art/drawing keywords", () => {
    const result = mapDiscoveryAnalysisToInterestSignals({
      talents: [{ name: "Creative Artist", confidence: 0.9, reasoning: "Draws and paints" }],
    });
    const keys = result.map((s) => s.interestKey);
    expect(keys).toContain("art");
  });

  it("maps building/lego keywords", () => {
    const result = mapDiscoveryAnalysisToInterestSignals({
      talents: [{ name: "Builder", confidence: 0.85, reasoning: "Loves lego and blocks" }],
    });
    const keys = result.map((s) => s.interestKey);
    expect(keys).toContain("building");
  });

  it("maps space keywords", () => {
    const result = mapDiscoveryAnalysisToInterestSignals({
      talents: [{ name: "Astronaut Dreams", confidence: 0.75, reasoning: "Fascinated by planets and stars" }],
    });
    const keys = result.map((s) => s.interestKey);
    expect(keys).toContain("space");
  });

  it("maps music keywords", () => {
    const result = mapDiscoveryAnalysisToInterestSignals({
      talents: [{ name: "Musical", confidence: 0.7, reasoning: "Loves rhythm and song" }],
    });
    const keys = result.map((s) => s.interestKey);
    expect(keys).toContain("music");
  });

  it("maps technology/robot keywords", () => {
    const result = mapDiscoveryAnalysisToInterestSignals({
      talents: [{ name: "Tech Whiz", confidence: 0.8, reasoning: "Interested in robots and computers" }],
    });
    const keys = result.map((s) => s.interestKey);
    expect(keys).toContain("technology");
  });

  it("maps nature/plant keywords", () => {
    const result = mapDiscoveryAnalysisToInterestSignals({
      talents: [{ name: "Outdoors", confidence: 0.65, reasoning: "Loves plants and nature" }],
    });
    const keys = result.map((s) => s.interestKey);
    expect(keys).toContain("nature");
  });

  it("maps storytelling keywords", () => {
    const result = mapDiscoveryAnalysisToInterestSignals({
      talents: [{ name: "Story Teller", confidence: 0.9, reasoning: "Creates vivid characters" }],
    });
    const keys = result.map((s) => s.interestKey);
    expect(keys).toContain("storytelling");
  });

  it("does not produce duplicate interest keys", () => {
    const result = mapDiscoveryAnalysisToInterestSignals({
      talents: [
        { name: "Science Lab", confidence: 0.8, reasoning: "science experiments" },
        { name: "Chemistry", confidence: 0.7, reasoning: "science lover" },
      ],
    });
    const keys = result.map((s) => s.interestKey);
    const uniqueKeys = new Set(keys);
    expect(keys.length).toBe(uniqueKeys.size);
  });

  it("strength is proportional to confidence", () => {
    const highConf = mapDiscoveryAnalysisToInterestSignals({
      talents: [{ name: "Science Explorer", confidence: 1.0, reasoning: "" }],
    });
    const lowConf = mapDiscoveryAnalysisToInterestSignals({
      talents: [{ name: "Science Explorer", confidence: 0.0, reasoning: "" }],
    });
    const highStrength = highConf.find((s) => s.interestKey === "science")?.strength ?? 0;
    const lowStrength = lowConf.find((s) => s.interestKey === "science")?.strength ?? 0;
    expect(highStrength).toBeGreaterThan(lowStrength);
  });

  it("strength is capped at 1", () => {
    const result = mapDiscoveryAnalysisToInterestSignals({
      talents: [{ name: "Science Explorer", confidence: 1.0, reasoning: "all science" }],
    });
    for (const signal of result) {
      expect(signal.strength).toBeLessThanOrEqual(1);
    }
  });

  it("confidence matches talent confidence", () => {
    const result = mapDiscoveryAnalysisToInterestSignals({
      talents: [{ name: "Space Explorer", confidence: 0.77, reasoning: "loves planets" }],
    });
    const spaceSignal = result.find((s) => s.interestKey === "space");
    expect(spaceSignal?.confidence).toBe(0.77);
  });

  it("handles missing confidence in talent", () => {
    const result = mapDiscoveryAnalysisToInterestSignals({
      talents: [{ name: "Art Maker", reasoning: "draws a lot" }],
    });
    expect(result.length).toBeGreaterThan(0);
  });

  it("handles empty talents array", () => {
    expect(mapDiscoveryAnalysisToInterestSignals({ talents: [] })).toEqual([]);
  });

  it("returns signals with correct dimension: engagement", () => {
    const result = mapDiscoveryAnalysisToInterestSignals({
      talents: [{ name: "Science Explorer", confidence: 0.8, reasoning: "" }],
    });
    const scienceSignal = result.find((s) => s.interestKey === "science");
    expect(scienceSignal?.dimension).toBe("engagement");
  });
});
