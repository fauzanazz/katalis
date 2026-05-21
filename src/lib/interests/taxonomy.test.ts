import { describe, expect, it } from "vitest";

import {
  INTEREST_SIGNAL_DIMENSIONS,
  INTEREST_SIGNAL_SOURCES,
  INTEREST_TAXONOMY_V1,
  assertInterestKey,
  assertInterestSignalDimension,
  isInterestKey,
  isInterestSignalDimension,
  isInterestSignalSource,
} from "./taxonomy";

function expectUnique(values: readonly string[]) {
  expect(new Set(values).size).toBe(values.length);
}

describe("interest taxonomy", () => {
  it("has unique interest keys", () => {
    expectUnique(INTEREST_TAXONOMY_V1);
  });

  it("accepts known interest keys", () => {
    expect(isInterestKey("nature")).toBe(true);
    expect(() => assertInterestKey("technology")).not.toThrow();
  });

  it("rejects unknown interest keys", () => {
    expect(isInterestKey("dinosaurs")).toBe(false);
    expect(() => assertInterestKey("dinosaurs")).toThrow("Unknown interest key: dinosaurs");
  });

  it("has unique signal sources", () => {
    expectUnique(INTEREST_SIGNAL_SOURCES);
  });

  it("has unique signal dimensions", () => {
    expectUnique(INTEREST_SIGNAL_DIMENSIONS);
  });

  it("isInterestSignalDimension accepts known dimensions", () => {
    expect(isInterestSignalDimension("engagement")).toBe(true);
    expect(isInterestSignalDimension("frustration")).toBe(true);
  });

  it("isInterestSignalDimension rejects unknown dimensions", () => {
    expect(isInterestSignalDimension("unknown_dim")).toBe(false);
    expect(isInterestSignalDimension("")).toBe(false);
  });

  it("assertInterestSignalDimension does not throw for known dimension", () => {
    expect(() => assertInterestSignalDimension("joy")).not.toThrow();
  });

  it("assertInterestSignalDimension throws for unknown dimension", () => {
    expect(() => assertInterestSignalDimension("anger")).toThrow(
      "Unknown interest signal dimension: anger",
    );
  });

  it("isInterestSignalSource accepts known sources", () => {
    expect(isInterestSignalSource("quest_completed")).toBe(true);
    expect(isInterestSignalSource("explicit_child_rating")).toBe(true);
  });

  it("isInterestSignalSource rejects unknown sources", () => {
    expect(isInterestSignalSource("unknown_source")).toBe(false);
  });
});
