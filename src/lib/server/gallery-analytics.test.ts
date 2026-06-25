import { describe, expect, it } from "vitest";

import { buildGalleryAnalytics } from "./gallery-analytics";

const DAY_MS = 24 * 60 * 60 * 1000;

function baseInput() {
  return {
    detectedTalents: [
      { name: "Storytelling", confidence: 0.4 },
      { name: "Engineering", confidence: 0.9 },
      { name: "Art", confidence: 0.7 },
    ],
    localContext: null,
    missions: [
      { status: "completed", proofPhotoUrl: "https://x/1.jpg" },
      { status: "completed", proofPhotoUrl: null },
      { status: "skipped", proofPhotoUrl: "https://x/3.jpg" },
    ],
    questCreatedAt: new Date("2026-06-01T00:00:00Z"),
    childDateOfBirth: null as Date | null,
    completedAt: new Date("2026-06-06T12:00:00Z"),
  };
}

describe("buildGalleryAnalytics — talents", () => {
  it("picks the highest-confidence talent as category and confidence", () => {
    const result = buildGalleryAnalytics(baseInput());
    expect(result.talentCategory).toBe("Engineering");
    expect(result.talentConfidence).toBe(0.9);
  });

  it("sorts detected talents by confidence descending", () => {
    const result = buildGalleryAnalytics(baseInput());
    expect(result.detectedTalents.map((t) => t.name)).toEqual([
      "Engineering",
      "Art",
      "Storytelling",
    ]);
  });

  it("falls back to Creative / null when no talents detected", () => {
    const result = buildGalleryAnalytics({ ...baseInput(), detectedTalents: [] });
    expect(result.talentCategory).toBe("Creative");
    expect(result.talentConfidence).toBeNull();
    expect(result.detectedTalents).toEqual([]);
  });

  it("does not mutate the input talents array", () => {
    const input = baseInput();
    const original = [...input.detectedTalents];
    buildGalleryAnalytics(input);
    expect(input.detectedTalents).toEqual(original);
  });
});

describe("buildGalleryAnalytics — effort metrics", () => {
  it("counts total missions, completed missions, and proof photos independently", () => {
    const result = buildGalleryAnalytics(baseInput());
    expect(result.missionCount).toBe(3);
    expect(result.completedMissionCount).toBe(2);
    expect(result.proofPhotoCount).toBe(2);
  });
});

describe("buildGalleryAnalytics — persistence (duration)", () => {
  it("returns whole elapsed days, floored", () => {
    // 2026-06-01T00:00 -> 2026-06-06T12:00 = 5.5 days -> 5
    expect(buildGalleryAnalytics(baseInput()).questDurationDays).toBe(5);
  });

  it("clamps negative durations to zero", () => {
    const result = buildGalleryAnalytics({
      ...baseInput(),
      questCreatedAt: new Date("2026-06-10T00:00:00Z"),
      completedAt: new Date("2026-06-06T00:00:00Z"),
    });
    expect(result.questDurationDays).toBe(0);
  });

  it("reports zero for a same-day completion", () => {
    const created = new Date("2026-06-06T08:00:00Z");
    const result = buildGalleryAnalytics({
      ...baseInput(),
      questCreatedAt: created,
      completedAt: new Date(created.getTime() + 3 * 60 * 60 * 1000),
    });
    expect(result.questDurationDays).toBe(0);
  });
});

describe("buildGalleryAnalytics — age cohort", () => {
  it("derives band and years from date of birth at completion time", () => {
    const completedAt = new Date("2026-06-06T00:00:00Z");
    const result = buildGalleryAnalytics({
      ...baseInput(),
      childDateOfBirth: new Date(completedAt.getTime() - 8 * 365.25 * DAY_MS),
      completedAt,
    });
    expect(result.ageBand).toBe("7-9");
    expect(result.ageYears).toBe(8);
  });

  it("returns unknown band with null years when DoB is missing", () => {
    const result = buildGalleryAnalytics({ ...baseInput(), childDateOfBirth: null });
    expect(result.ageBand).toBe("unknown");
    expect(result.ageYears).toBeNull();
  });
});

describe("buildGalleryAnalytics — geocoding", () => {
  it("yields null country/coordinates for empty local context", () => {
    const result = buildGalleryAnalytics({ ...baseInput(), localContext: null });
    expect(result.country).toBeNull();
    expect(result.coordinates).toBeNull();
  });

  it("resolves country and coordinates from Indonesian local context", () => {
    const result = buildGalleryAnalytics({
      ...baseInput(),
      localContext: "Sebuah desa kecil di dekat sawah",
    });
    expect(result.country).toBeTruthy();
    expect(result.coordinates).not.toBeNull();
    expect(typeof result.coordinates?.lat).toBe("number");
    expect(typeof result.coordinates?.lng).toBe("number");
  });
});
