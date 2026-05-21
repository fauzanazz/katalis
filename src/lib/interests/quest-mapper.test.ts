import { describe, it, expect } from "vitest";
import { mapQuestToInterestSignals, mapMissionCompletionToInterestSignals } from "./quest-mapper";

describe("mapQuestToInterestSignals", () => {
  it("returns empty array for null", () => {
    expect(mapQuestToInterestSignals(null)).toEqual([]);
  });

  it("returns empty array for quest with no text", () => {
    expect(mapQuestToInterestSignals({})).toEqual([]);
  });

  it("maps science keyword in dream to science interest", () => {
    const signals = mapQuestToInterestSignals({ dream: "I want to do science experiments" });
    expect(signals.map((s) => s.interestKey)).toContain("science");
  });

  it("maps space keyword in localContext", () => {
    const signals = mapQuestToInterestSignals({ dream: "My dream", localContext: "I love planets and stars" });
    expect(signals.map((s) => s.interestKey)).toContain("space");
  });

  it("maps building keyword in dream", () => {
    const signals = mapQuestToInterestSignals({ dream: "I want to build with lego" });
    expect(signals.map((s) => s.interestKey)).toContain("building");
  });

  it("maps talent names to interest keys", () => {
    const signals = mapQuestToInterestSignals({
      dream: "My dream",
      talents: [{ name: "Music Lover", confidence: 0.8 }],
    });
    expect(signals.map((s) => s.interestKey)).toContain("music");
  });

  it("produces dimension: curiosity for quest-started signals", () => {
    const signals = mapQuestToInterestSignals({ dream: "I want to do science experiments" });
    for (const s of signals) {
      expect(s.dimension).toBe("curiosity");
    }
  });

  it("strength is 0.25 per plan spec", () => {
    const signals = mapQuestToInterestSignals({ dream: "I love building robots" });
    for (const s of signals) {
      expect(s.strength).toBe(0.25);
    }
  });

  it("confidence is 0.5 by default", () => {
    const signals = mapQuestToInterestSignals({ dream: "I love building robots" });
    for (const s of signals) {
      expect(s.confidence).toBeGreaterThan(0);
      expect(s.confidence).toBeLessThanOrEqual(1);
    }
  });

  it("does not produce duplicate interest keys", () => {
    const signals = mapQuestToInterestSignals({
      dream: "I want to build with lego and blocks and construct things",
    });
    const keys = signals.map((s) => s.interestKey);
    expect(keys.length).toBe(new Set(keys).size);
  });
});

describe("mapMissionCompletionToInterestSignals", () => {
  it("returns empty array for empty input", () => {
    expect(mapMissionCompletionToInterestSignals({})).toEqual([]);
  });

  it("maps quest dream to interest keys", () => {
    const signals = mapMissionCompletionToInterestSignals({
      quest: { dream: "I want to build robots and machines" },
    });
    expect(signals.map((s) => s.interestKey)).toContain("building");
  });

  it("maps mission title to interest keys", () => {
    const signals = mapMissionCompletionToInterestSignals({
      mission: { title: "Draw a nature scene", description: "Paint plants and animals" },
    });
    const keys = signals.map((s) => s.interestKey);
    expect(keys).toContain("art");
  });

  it("maps reflection text to interest keys", () => {
    const signals = mapMissionCompletionToInterestSignals({
      reflection: { text: "I loved doing the music today", feeling: "happy" },
    });
    expect(signals.map((s) => s.interestKey)).toContain("music");
  });

  it("produces dimension: engagement for mission-completed signals", () => {
    const signals = mapMissionCompletionToInterestSignals({
      quest: { dream: "I want to do science" },
    });
    for (const s of signals) {
      expect(s.dimension).toBe("engagement");
    }
  });

  it("strength is 0.6 per plan spec", () => {
    const signals = mapMissionCompletionToInterestSignals({
      quest: { dream: "I love building robots" },
    });
    for (const s of signals) {
      expect(s.strength).toBe(0.6);
    }
  });

  it("confidence is 0.7 per plan spec", () => {
    const signals = mapMissionCompletionToInterestSignals({
      quest: { dream: "I love building robots" },
    });
    for (const s of signals) {
      expect(s.confidence).toBe(0.7);
    }
  });

  it("combines quest, mission, and reflection text", () => {
    const signals = mapMissionCompletionToInterestSignals({
      quest: { dream: "I want to learn science" },
      mission: { title: "Music task", description: "Play an instrument" },
      reflection: { text: "I love art and drawing" },
    });
    const keys = signals.map((s) => s.interestKey);
    expect(keys).toContain("science");
    expect(keys).toContain("music");
    expect(keys).toContain("art");
  });

  it("does not produce duplicate keys", () => {
    const signals = mapMissionCompletionToInterestSignals({
      quest: { dream: "science experiments" },
      mission: { title: "science lab", description: "do science" },
    });
    const keys = signals.map((s) => s.interestKey);
    expect(keys.length).toBe(new Set(keys).size);
  });
});
