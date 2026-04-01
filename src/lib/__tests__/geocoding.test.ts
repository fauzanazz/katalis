import { describe, it, expect } from "vitest";
import { geocodeLocationText } from "@/lib/geocoding";

describe("geocodeLocationText", () => {
  it("returns null for null or undefined input", () => {
    expect(geocodeLocationText(null)).toBeNull();
    expect(geocodeLocationText(undefined)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(geocodeLocationText("")).toBeNull();
    expect(geocodeLocationText("  ")).toBeNull();
  });

  it("returns null for text with no identifiable location", () => {
    expect(geocodeLocationText("I live near a river")).toBeNull();
    expect(geocodeLocationText("My neighborhood has parks")).toBeNull();
  });

  it("geocodes explicit country names (Indonesia)", () => {
    const result = geocodeLocationText("I live in Indonesia near a river");
    expect(result).not.toBeNull();
    expect(result!.country).toBe("Indonesia");
    expect(result!.coordinates.lat).toBeCloseTo(-2.5, 0);
    expect(result!.coordinates.lng).toBeCloseTo(118.0, 0);
  });

  it("geocodes explicit country names (Japan)", () => {
    const result = geocodeLocationText("I live in Japan in a small town");
    expect(result).not.toBeNull();
    expect(result!.country).toBe("Japan");
    expect(result!.coordinates.lat).toBeCloseTo(36.2, 0);
  });

  it("geocodes explicit country names (Brazil)", () => {
    const result = geocodeLocationText("My family is from Brazil");
    expect(result).not.toBeNull();
    expect(result!.country).toBe("Brazil");
  });

  it("geocodes Indonesian city/region names", () => {
    const result = geocodeLocationText("I live in Jakarta with my family");
    expect(result).not.toBeNull();
    expect(result!.country).toBe("Indonesia");
    expect(result!.coordinates.lat).toBeCloseTo(-6.21, 0);
  });

  it("geocodes Indonesian region names (Bali)", () => {
    const result = geocodeLocationText("We have a house in Bali near the beach");
    expect(result).not.toBeNull();
    expect(result!.country).toBe("Indonesia");
    expect(result!.coordinates.lat).toBeCloseTo(-8.34, 0);
  });

  it("geocodes Indonesian keywords (desa/kampung) as Indonesia fallback", () => {
    const result = geocodeLocationText("Saya tinggal di desa dekat sawah dan sungai");
    expect(result).not.toBeNull();
    expect(result!.country).toBe("Indonesia");
    expect(result!.coordinates.lat).toBeCloseTo(-2.5, 0);
  });

  it("handles case-insensitive matching", () => {
    const result = geocodeLocationText("i live in INDONESIA");
    expect(result).not.toBeNull();
    expect(result!.country).toBe("Indonesia");
  });

  it("geocodes USA aliases", () => {
    const result1 = geocodeLocationText("I live in the United States");
    expect(result1).not.toBeNull();
    expect(result1!.country).toBe("United States");

    const result2 = geocodeLocationText("I am from USA");
    expect(result2).not.toBeNull();
    expect(result2!.country).toBe("United States");
  });

  it("geocodes UK aliases", () => {
    const result = geocodeLocationText("I live in UK");
    expect(result).not.toBeNull();
    expect(result!.country).toBe("United Kingdom");
  });

  it("prioritizes longer matches", () => {
    // "South Korea" should match before "Korea"
    const result = geocodeLocationText("I live in South Korea");
    expect(result).not.toBeNull();
    expect(result!.country).toBe("South Korea");
  });

  it("returns coordinates with lat and lng", () => {
    const result = geocodeLocationText("I live in Australia");
    expect(result).not.toBeNull();
    expect(typeof result!.coordinates.lat).toBe("number");
    expect(typeof result!.coordinates.lng).toBe("number");
    expect(result!.coordinates.lat).toBeCloseTo(-25.3, 0);
    expect(result!.coordinates.lng).toBeCloseTo(133.8, 0);
  });
});
