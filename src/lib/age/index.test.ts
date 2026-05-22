import { describe, expect, it } from "vitest";

import { AGE_BANDS, getAgeGroup, type AgeGroup } from "./index";

const YEAR_MS = 365.25 * 24 * 60 * 60 * 1000;

function dobForAge(years: number, now = new Date()): Date {
  return new Date(now.getTime() - years * YEAR_MS);
}

describe("AGE_BANDS", () => {
  it("defines exactly three numeric bands with non-overlapping ranges", () => {
    expect(AGE_BANDS).toEqual({
      "3-6": { min: 3, max: 6 },
      "7-9": { min: 7, max: 9 },
      "10-12": { min: 10, max: 12 },
    });
  });
});

describe("getAgeGroup — null / undefined / invalid input", () => {
  it("returns unknown with null years for null DoB", () => {
    expect(getAgeGroup(null)).toEqual({ band: "unknown", years: null });
  });

  it("returns unknown with null years for undefined DoB", () => {
    expect(getAgeGroup(undefined)).toEqual({ band: "unknown", years: null });
  });

  it("returns unknown with null years when DoB is in the future", () => {
    const future = new Date(Date.now() + 24 * 60 * 60 * 1000);
    expect(getAgeGroup(future)).toEqual({ band: "unknown", years: null });
  });
});

describe("getAgeGroup — band mapping", () => {
  const cases: Array<{ age: number; band: AgeGroup }> = [
    { age: 3, band: "3-6" },
    { age: 4, band: "3-6" },
    { age: 5, band: "3-6" },
    { age: 6, band: "3-6" },
    { age: 7, band: "7-9" },
    { age: 8, band: "7-9" },
    { age: 9, band: "7-9" },
    { age: 10, band: "10-12" },
    { age: 11, band: "10-12" },
    { age: 12, band: "10-12" },
  ];

  for (const { age, band } of cases) {
    it(`age ${age} → band ${band}`, () => {
      const now = new Date("2026-05-22T12:00:00Z");
      const dob = dobForAge(age, now);
      const result = getAgeGroup(dob, now);
      expect(result.band).toBe(band);
      expect(result.years).toBe(age);
    });
  }
});

describe("getAgeGroup — out of supported range", () => {
  it("age 0 (newborn) → unknown band with years=0", () => {
    const now = new Date("2026-05-22T12:00:00Z");
    const dob = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const result = getAgeGroup(dob, now);
    expect(result.band).toBe("unknown");
    expect(result.years).toBe(0);
  });

  it("age 2 (too young) → unknown band with years=2", () => {
    const now = new Date("2026-05-22T12:00:00Z");
    const dob = dobForAge(2, now);
    const result = getAgeGroup(dob, now);
    expect(result.band).toBe("unknown");
    expect(result.years).toBe(2);
  });

  it("age 13 (too old) → unknown band with years=13", () => {
    const now = new Date("2026-05-22T12:00:00Z");
    const dob = dobForAge(13, now);
    const result = getAgeGroup(dob, now);
    expect(result.band).toBe("unknown");
    expect(result.years).toBe(13);
  });

  it("age 18 → unknown band with years=18", () => {
    const now = new Date("2026-05-22T12:00:00Z");
    const dob = dobForAge(18, now);
    const result = getAgeGroup(dob, now);
    expect(result.band).toBe("unknown");
    expect(result.years).toBe(18);
  });
});

describe("getAgeGroup — birthday boundary semantics", () => {
  it("on exact birthday, band reflects the new age", () => {
    const dob = new Date("2018-05-22T00:00:00Z");
    const now = new Date("2026-05-22T12:00:00Z");
    const result = getAgeGroup(dob, now);
    expect(result.years).toBe(8);
    expect(result.band).toBe("7-9");
  });

  it("one day before birthday, age has not yet incremented", () => {
    const dob = new Date("2018-05-22T00:00:00Z");
    const now = new Date("2026-05-21T12:00:00Z");
    const result = getAgeGroup(dob, now);
    expect(result.years).toBe(7);
    expect(result.band).toBe("7-9");
  });

  it("birthday that crosses band boundary (6 → 7)", () => {
    const dob = new Date("2019-05-22T00:00:00Z");
    const dayBefore = new Date("2026-05-21T12:00:00Z");
    const onDay = new Date("2026-05-22T12:00:00Z");
    expect(getAgeGroup(dob, dayBefore).band).toBe("3-6");
    expect(getAgeGroup(dob, dayBefore).years).toBe(6);
    expect(getAgeGroup(dob, onDay).band).toBe("7-9");
    expect(getAgeGroup(dob, onDay).years).toBe(7);
  });

  it("birthday that crosses band boundary (9 → 10)", () => {
    const dob = new Date("2016-05-22T00:00:00Z");
    const dayBefore = new Date("2026-05-21T12:00:00Z");
    const onDay = new Date("2026-05-22T12:00:00Z");
    expect(getAgeGroup(dob, dayBefore).band).toBe("7-9");
    expect(getAgeGroup(dob, dayBefore).years).toBe(9);
    expect(getAgeGroup(dob, onDay).band).toBe("10-12");
    expect(getAgeGroup(dob, onDay).years).toBe(10);
  });

  it("birthday that crosses out of supported range (12 → 13)", () => {
    const dob = new Date("2013-05-22T00:00:00Z");
    const dayBefore = new Date("2026-05-21T12:00:00Z");
    const onDay = new Date("2026-05-22T12:00:00Z");
    expect(getAgeGroup(dob, dayBefore).band).toBe("10-12");
    expect(getAgeGroup(dob, dayBefore).years).toBe(12);
    expect(getAgeGroup(dob, onDay).band).toBe("unknown");
    expect(getAgeGroup(dob, onDay).years).toBe(13);
  });
});

describe("getAgeGroup — leap day edge", () => {
  it("Feb 29 birthday: non-leap year, uses Mar 1 as effective birthday", () => {
    const dob = new Date("2016-02-29T00:00:00Z");
    const feb28 = new Date("2025-02-28T12:00:00Z");
    const mar1 = new Date("2025-03-01T12:00:00Z");
    expect(getAgeGroup(dob, feb28).years).toBe(8);
    expect(getAgeGroup(dob, mar1).years).toBe(9);
  });
});
