import { describe, expect, it } from "vitest";

import { detectFrustration, resolveCheckinAction, applyCheckinOverride } from "./frustration";

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

describe("detectFrustration — inactivity signal", () => {
  it("no inactivity field → no extra score", () => {
    expect(detectFrustration(baseContext)).toBe("none");
  });

  it("inactivity ≥5 min pushes score enough for low", () => {
    const result = detectFrustration({ ...baseContext, inactivityMinutes: 5 });
    expect(severityRank(result)).toBeGreaterThanOrEqual(severityRank("low"));
  });

  it("inactivity ≥10 min scores +4 — sufficient for medium alone", () => {
    const result = detectFrustration({ ...baseContext, inactivityMinutes: 10 });
    expect(severityRank(result)).toBeGreaterThanOrEqual(severityRank("medium"));
  });

  it("inactivity <5 min adds no score", () => {
    expect(detectFrustration({ ...baseContext, inactivityMinutes: 4 })).toBe("none");
  });
});

describe("detectFrustration — edit behavior signal", () => {
  it("no editEvents → no extra score", () => {
    expect(detectFrustration(baseContext)).toBe("none");
  });

  it("editEvents total ≥3 adds score", () => {
    const result = detectFrustration({
      ...baseContext,
      editEvents: { deletes: 2, redos: 1 },
    });
    expect(severityRank(result)).toBeGreaterThanOrEqual(severityRank("low"));
  });

  it("editEvents total ≥6 adds more score than ≥3", () => {
    const low = detectFrustration({ ...baseContext, editEvents: { deletes: 2, redos: 1 } });
    const high = detectFrustration({ ...baseContext, editEvents: { deletes: 4, redos: 2 } });
    expect(severityRank(high)).toBeGreaterThanOrEqual(severityRank(low));
  });

  it("editEvents total <3 adds no score", () => {
    expect(detectFrustration({ ...baseContext, editEvents: { deletes: 1, redos: 1 } })).toBe("none");
  });
});

describe("detectFrustration — voice prosody", () => {
  it("no prosody field → no extra score", () => {
    expect(detectFrustration(baseContext)).toBe("none");
  });

  it("pitch drop ≥0.3 contributes score", () => {
    const result = detectFrustration({
      ...baseContext,
      voiceProsody: { pitchDropRatio: 0.4 },
    });
    expect(severityRank(result)).toBeGreaterThanOrEqual(severityRank("low"));
  });

  it("very low speech rate (≤40 wpm) contributes more than mild drop", () => {
    const mild = detectFrustration({
      ...baseContext,
      voiceProsody: { speechRateWpm: 55 },
    });
    const severe = detectFrustration({
      ...baseContext,
      voiceProsody: { speechRateWpm: 30 },
    });
    expect(severityRank(severe)).toBeGreaterThanOrEqual(severityRank(mild));
  });

  it("high pause ratio + pitch drop combine but cap at 4 (cannot alone hit high)", () => {
    const result = detectFrustration({
      ...baseContext,
      voiceProsody: {
        pitchDropRatio: 0.7,
        pauseRatioPct: 0.8,
        speechRateWpm: 25,
      },
    });
    // Capped at 4 → medium, not high
    expect(result).toBe("medium");
  });

  it("speechRateWpm=0 is ignored (not treated as silence)", () => {
    expect(
      detectFrustration({ ...baseContext, voiceProsody: { speechRateWpm: 0 } }),
    ).toBe("none");
  });
});

describe("detectFrustration — combined multi-signal", () => {
  it("inactivity + keyword signals combine to high", () => {
    const result = detectFrustration({
      ...baseContext,
      inactivityMinutes: 10,
      recentChildMessages: ["I can't do this", "too hard", "stuck", "give up", "hate it"],
    });
    expect(result).toBe("high");
  });

  it("edit behavior + message count combine to trigger frustration", () => {
    const result = detectFrustration({
      ...baseContext,
      childMessageCount: 6,
      editEvents: { deletes: 4, redos: 2 },
    });
    expect(severityRank(result)).toBeGreaterThanOrEqual(severityRank("medium"));
  });
});

describe("resolveCheckinAction", () => {
  it("returns null for none/low frustration regardless of pendingCheckin", () => {
    expect(resolveCheckinAction("none", false)).toBeNull();
    expect(resolveCheckinAction("none", true)).toBeNull();
    expect(resolveCheckinAction("low", false)).toBeNull();
    expect(resolveCheckinAction("low", true)).toBeNull();
  });

  it("returns checkin for medium/high when pendingCheckin is false", () => {
    expect(resolveCheckinAction("medium", false)).toBe("checkin");
    expect(resolveCheckinAction("high", false)).toBe("checkin");
  });

  it("returns adjustment for medium/high when pendingCheckin is true", () => {
    expect(resolveCheckinAction("medium", true)).toBe("adjustment");
    expect(resolveCheckinAction("high", true)).toBe("adjustment");
  });
});

describe("applyCheckinOverride", () => {
  it("returns 'low' when action is 'checkin', regardless of real level", () => {
    expect(applyCheckinOverride("medium", "checkin")).toBe("low");
    expect(applyCheckinOverride("high", "checkin")).toBe("low");
  });

  it("returns real level when action is 'adjustment'", () => {
    expect(applyCheckinOverride("high", "adjustment")).toBe("high");
    expect(applyCheckinOverride("medium", "adjustment")).toBe("medium");
  });

  it("returns real level when action is null", () => {
    expect(applyCheckinOverride("none", null)).toBe("none");
    expect(applyCheckinOverride("low", null)).toBe("low");
    expect(applyCheckinOverride("medium", null)).toBe("medium");
  });
});

function severityRank(level: "none" | "low" | "medium" | "high"): number {
  return { none: 0, low: 1, medium: 2, high: 3 }[level];
}
