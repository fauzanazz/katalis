import { describe, expect, it } from "vitest";

import type { AgeGroup } from "@/lib/age";
import {
  ALLOWED_MODALITIES,
  MODALITY_LIST,
  isModalityAllowed,
  type Modality,
} from "./age-modality";

const ALL_BANDS: AgeGroup[] = ["3-6", "7-9", "10-12", "unknown"];

describe("MODALITY_LIST", () => {
  it("defines the three discover input modalities", () => {
    expect(MODALITY_LIST).toEqual(["photo", "voice", "text"]);
  });
});

describe("ALLOWED_MODALITIES", () => {
  it("3-6: photo only", () => {
    expect(ALLOWED_MODALITIES["3-6"]).toEqual(["photo"]);
  });

  it("7-9: photo + voice", () => {
    expect(ALLOWED_MODALITIES["7-9"]).toEqual(["photo", "voice"]);
  });

  it("10-12: photo + voice + text", () => {
    expect(ALLOWED_MODALITIES["10-12"]).toEqual(["photo", "voice", "text"]);
  });

  it("unknown: aliases 7-9 baseline (photo + voice)", () => {
    expect(ALLOWED_MODALITIES.unknown).toEqual(["photo", "voice"]);
  });

  it("every band entry is a subset of MODALITY_LIST", () => {
    for (const band of ALL_BANDS) {
      const set = new Set(MODALITY_LIST);
      for (const m of ALLOWED_MODALITIES[band]) {
        expect(set.has(m), `band ${band} → ${m} not in MODALITY_LIST`).toBe(true);
      }
    }
  });
});

describe("isModalityAllowed", () => {
  it("returns true only when the modality is in the band's allowed list", () => {
    const truthTable: Array<{ band: AgeGroup; modality: Modality; allowed: boolean }> = [
      { band: "3-6", modality: "photo", allowed: true },
      { band: "3-6", modality: "voice", allowed: false },
      { band: "3-6", modality: "text", allowed: false },
      { band: "7-9", modality: "photo", allowed: true },
      { band: "7-9", modality: "voice", allowed: true },
      { band: "7-9", modality: "text", allowed: false },
      { band: "10-12", modality: "photo", allowed: true },
      { band: "10-12", modality: "voice", allowed: true },
      { band: "10-12", modality: "text", allowed: true },
      { band: "unknown", modality: "photo", allowed: true },
      { band: "unknown", modality: "voice", allowed: true },
      { band: "unknown", modality: "text", allowed: false },
    ];

    for (const { band, modality, allowed } of truthTable) {
      expect(isModalityAllowed(band, modality), `${band}/${modality}`).toBe(allowed);
    }
  });

  it("handles null/undefined band → unknown fallback", () => {
    expect(isModalityAllowed(null, "photo")).toBe(true);
    expect(isModalityAllowed(null, "text")).toBe(false);
    expect(isModalityAllowed(undefined, "voice")).toBe(true);
  });
});
