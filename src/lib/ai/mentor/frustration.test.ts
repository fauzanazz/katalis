import { describe, expect, it } from "vitest";

import { detectFrustration } from "./frustration";

const baseContext = {
  messageCount: 0,
  childMessageCount: 0,
  sessionDurationMinutes: 0,
  recentChildMessages: [],
};

describe("detectFrustration — base behavior", () => {
  it("returns none for empty context", () => {
    expect(detectFrustration(baseContext)).toBe("none");
  });

  it("returns high when all three signals are at the high threshold (default 7-9)", () => {
    const result = detectFrustration({
      messageCount: 10,
      childMessageCount: 10,
      sessionDurationMinutes: 30,
      recentChildMessages: ["I can't do this", "this is too hard", "stuck", "give up"],
    });
    expect(result).toBe("high");
  });
});

describe("detectFrustration — age-band sensitivity", () => {
  it("3-6 child crosses to low with fewer messages than 7-9 child stays at none", () => {
    const context = { ...baseContext, childMessageCount: 4 };
    expect(detectFrustration(context, "3-6")).not.toBe("none");
    expect(detectFrustration(context, "7-9")).toBe("none");
  });

  it("same context yields stricter level for 3-6 than 10-12", () => {
    const context = {
      messageCount: 6,
      childMessageCount: 6,
      sessionDurationMinutes: 16,
      recentChildMessages: ["hard", "stuck"],
    };
    const young = detectFrustration(context, "3-6");
    const old = detectFrustration(context, "10-12");
    expect(severityRank(young)).toBeGreaterThan(severityRank(old));
  });

  it("unknown band aliases 7-9 baseline", () => {
    const context = {
      messageCount: 7,
      childMessageCount: 7,
      sessionDurationMinutes: 16,
      recentChildMessages: ["confused", "stuck"],
    };
    expect(detectFrustration(context, "unknown")).toBe(detectFrustration(context, "7-9"));
  });

  it("calling without ageGroup defaults to unknown (= 7-9)", () => {
    const context = {
      messageCount: 7,
      childMessageCount: 7,
      sessionDurationMinutes: 16,
      recentChildMessages: ["confused", "stuck"],
    };
    expect(detectFrustration(context)).toBe(detectFrustration(context, "7-9"));
  });
});

function severityRank(level: "none" | "low" | "medium" | "high"): number {
  return { none: 0, low: 1, medium: 2, high: 3 }[level];
}
