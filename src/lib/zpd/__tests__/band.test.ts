import { describe, it, expect } from "vitest";
import { scoreToBand, bandRank, ZPD_BANDS } from "@/lib/zpd/band";

describe("scoreToBand", () => {
  it("maps 0 to emerging", () => {
    expect(scoreToBand(0)).toBe("emerging");
  });

  it("maps 0.24 to emerging (upper edge)", () => {
    expect(scoreToBand(0.24)).toBe("emerging");
  });

  it("maps 0.25 to developing (lower edge)", () => {
    expect(scoreToBand(0.25)).toBe("developing");
  });

  it("maps 0.49 to developing", () => {
    expect(scoreToBand(0.49)).toBe("developing");
  });

  it("maps 0.50 to proficient (lower edge)", () => {
    expect(scoreToBand(0.5)).toBe("proficient");
  });

  it("maps 0.74 to proficient", () => {
    expect(scoreToBand(0.74)).toBe("proficient");
  });

  it("maps 0.75 to extending (lower edge)", () => {
    expect(scoreToBand(0.75)).toBe("extending");
  });

  it("maps 1.0 to extending", () => {
    expect(scoreToBand(1)).toBe("extending");
  });

  it("clamps negative input to emerging", () => {
    expect(scoreToBand(-0.5)).toBe("emerging");
  });

  it("clamps >1 input to extending", () => {
    expect(scoreToBand(1.5)).toBe("extending");
  });
});

describe("bandRank", () => {
  it("ranks emerging lowest", () => {
    expect(bandRank("emerging")).toBe(0);
  });

  it("orders all four bands ascending", () => {
    expect(bandRank("developing")).toBeGreaterThan(bandRank("emerging"));
    expect(bandRank("proficient")).toBeGreaterThan(bandRank("developing"));
    expect(bandRank("extending")).toBeGreaterThan(bandRank("proficient"));
  });
});

describe("ZPD_BANDS", () => {
  it("contains exactly four bands in canonical order", () => {
    expect(ZPD_BANDS).toEqual([
      "emerging",
      "developing",
      "proficient",
      "extending",
    ]);
  });
});
