import { describe, expect, it } from "vitest";
import { getNextHeaderHiddenState } from "../stickyHeader";

describe("getNextHeaderHiddenState", () => {
  it("keeps the header visible near the top", () => {
    expect(
      getNextHeaderHiddenState({
        previousScrollY: 18,
        currentScrollY: 12,
        isHidden: true,
      }),
    ).toBe(false);
  });

  it("hides the header when scrolling down past the threshold", () => {
    expect(
      getNextHeaderHiddenState({
        previousScrollY: 80,
        currentScrollY: 140,
        isHidden: false,
      }),
    ).toBe(true);
  });

  it("shows the header again when scrolling up", () => {
    expect(
      getNextHeaderHiddenState({
        previousScrollY: 180,
        currentScrollY: 120,
        isHidden: true,
      }),
    ).toBe(false);
  });
});
