import { describe, expect, it } from "vitest";

import { summarizeTalentJourney, type TalentJourneySummaryInput } from "./data-export";

const NOW = new Date("2026-06-20T00:00:00Z");
const DAY_MS = 24 * 60 * 60 * 1000;

function baseInput(): TalentJourneySummaryInput {
  return {
    child: {
      dateOfBirth: new Date(NOW.getTime() - 9 * 365.25 * DAY_MS),
      createdAt: new Date(NOW.getTime() - 30 * DAY_MS),
    },
    discoveries: [
      { type: "image", detectedTalents: [{ name: "Art", confidence: 0.8 }] },
      {
        type: "story",
        detectedTalents: [
          { name: "Art", confidence: 0.6 },
          { name: "Storytelling", confidence: 0.9 },
        ],
      },
    ],
    quests: [
      {
        status: "completed",
        createdAt: new Date(NOW.getTime() - 20 * DAY_MS),
        missions: [
          { status: "completed", proofPhotoUrl: "u1" },
          { status: "completed", proofPhotoUrl: null },
        ],
      },
      {
        status: "abandoned",
        createdAt: new Date(NOW.getTime() - 10 * DAY_MS),
        missions: [{ status: "locked", proofPhotoUrl: null }],
      },
    ],
    galleryEntries: [
      {
        talentCategory: "Art",
        talentConfidence: 0.8,
        questDurationDays: 6,
        detectedTalents: [{ name: "Art", confidence: 0.8 }],
      },
      {
        talentCategory: "Art",
        talentConfidence: 0.6,
        questDurationDays: 4,
        detectedTalents: [{ name: "Art", confidence: 0.6 }],
      },
    ],
    badges: [{ badgeSlug: "first-quest" }, { badgeSlug: "explorer" }],
    reflectionCount: 5,
    mentorSessionCount: 3,
    mentorMessageCount: 42,
    interestProfiles: [
      { interestKey: "drawing", score: 0.9, trend: "rising", stability: "enduring" },
      { interestKey: "music", score: 0.3, trend: "stable", stability: "fleeting" },
    ],
    gardnerProfiles: [
      { intelligence: "visual_arts", score: 0.7 },
      { intelligence: "linguistic", score: 0.5 },
    ],
    zpd: {
      current: { score: 0.6, band: "proficient" },
      snapshots: [
        { score: 0.3, createdAt: new Date(NOW.getTime() - 25 * DAY_MS) },
        { score: 0.6, createdAt: new Date(NOW.getTime() - 1 * DAY_MS) },
      ],
    },
    now: NOW,
  };
}

describe("summarizeTalentJourney — effort & persistence", () => {
  it("counts quests by status with completion rate", () => {
    const s = summarizeTalentJourney(baseInput());
    expect(s.quests).toEqual({
      started: 2,
      completed: 1,
      active: 0,
      abandoned: 1,
      completionRate: 0.5,
    });
  });

  it("counts missions and proof photos across all quests", () => {
    const s = summarizeTalentJourney(baseInput());
    expect(s.missions.total).toBe(3);
    expect(s.missions.completed).toBe(2);
    expect(s.missions.proofPhotos).toBe(1);
    expect(s.missions.completionRate).toBeCloseTo(0.667, 2);
  });

  it("reports account age in whole days", () => {
    expect(summarizeTalentJourney(baseInput()).accountAgeDays).toBe(30);
  });
});

describe("summarizeTalentJourney — talents (breadth & depth)", () => {
  it("aggregates distinct talents across discoveries and gallery", () => {
    const s = summarizeTalentJourney(baseInput());
    expect(s.talents.distinctTalents).toBe(2);
    const art = s.talents.top.find((t) => t.name === "Art");
    expect(art).toEqual({ name: "Art", occurrences: 4, avgConfidence: 0.7 });
  });

  it("orders top talents by occurrences then confidence", () => {
    const s = summarizeTalentJourney(baseInput());
    expect(s.talents.top[0].name).toBe("Art");
  });
});

describe("summarizeTalentJourney — gallery", () => {
  it("averages quest duration and groups talent categories with avg confidence", () => {
    const s = summarizeTalentJourney(baseInput());
    expect(s.gallery.works).toBe(2);
    expect(s.gallery.avgQuestDurationDays).toBe(5);
    expect(s.gallery.talentCategories.Art).toEqual({ count: 2, avgConfidence: 0.7 });
  });
});

describe("summarizeTalentJourney — interests, intelligences, growth", () => {
  it("counts rising and enduring interests, sorts top by score", () => {
    const s = summarizeTalentJourney(baseInput());
    expect(s.interests.tracked).toBe(2);
    expect(s.interests.rising).toBe(1);
    expect(s.interests.enduring).toBe(1);
    expect(s.interests.top[0].interestKey).toBe("drawing");
  });

  it("sorts intelligences by score descending", () => {
    const s = summarizeTalentJourney(baseInput());
    expect(s.intelligences.map((i) => i.intelligence)).toEqual([
      "visual_arts",
      "linguistic",
    ]);
  });

  it("computes ZPD growth delta from first snapshot to current", () => {
    const s = summarizeTalentJourney(baseInput());
    expect(s.growth.firstScore).toBe(0.3);
    expect(s.growth.currentScore).toBe(0.6);
    expect(s.growth.scoreDelta).toBeCloseTo(0.3, 5);
    expect(s.growth.currentBand).toBe("proficient");
  });
});

describe("summarizeTalentJourney — empty journey", () => {
  it("returns zeroed metrics without throwing", () => {
    const s = summarizeTalentJourney({
      child: { dateOfBirth: null, createdAt: NOW },
      discoveries: [],
      quests: [],
      galleryEntries: [],
      badges: [],
      reflectionCount: 0,
      mentorSessionCount: 0,
      mentorMessageCount: 0,
      interestProfiles: [],
      gardnerProfiles: [],
      zpd: { current: null, snapshots: [] },
      now: NOW,
    });
    expect(s.quests.completionRate).toBe(0);
    expect(s.missions.completionRate).toBe(0);
    expect(s.talents.distinctTalents).toBe(0);
    expect(s.gallery.avgQuestDurationDays).toBeNull();
    expect(s.growth.scoreDelta).toBeNull();
    expect(s.ageBand).toBe("unknown");
  });
});
