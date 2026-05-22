import { describe, expect, it } from "vitest";

import { BehavioralSignalsSchema, SendMessageInputSchema } from "./mentor-schemas";

describe("BehavioralSignalsSchema", () => {
  it("accepts empty object (all fields optional)", () => {
    expect(BehavioralSignalsSchema.safeParse({}).success).toBe(true);
  });

  it("accepts valid lastInputAt ISO datetime", () => {
    const result = BehavioralSignalsSchema.safeParse({
      lastInputAt: "2026-05-22T02:00:00.000Z",
    });
    expect(result.success).toBe(true);
  });

  it("rejects non-ISO lastInputAt", () => {
    const result = BehavioralSignalsSchema.safeParse({ lastInputAt: "not-a-date" });
    expect(result.success).toBe(false);
  });

  it("accepts valid editEvents", () => {
    const result = BehavioralSignalsSchema.safeParse({
      editEvents: { deletes: 3, redos: 1 },
    });
    expect(result.success).toBe(true);
  });

  it("accepts editEvents with zero counts", () => {
    const result = BehavioralSignalsSchema.safeParse({
      editEvents: { deletes: 0, redos: 0 },
    });
    expect(result.success).toBe(true);
  });

  it("rejects negative editEvents counts", () => {
    expect(
      BehavioralSignalsSchema.safeParse({ editEvents: { deletes: -1, redos: 0 } }).success,
    ).toBe(false);
    expect(
      BehavioralSignalsSchema.safeParse({ editEvents: { deletes: 0, redos: -1 } }).success,
    ).toBe(false);
  });

  it("rejects non-integer editEvents counts", () => {
    expect(
      BehavioralSignalsSchema.safeParse({ editEvents: { deletes: 1.5, redos: 0 } }).success,
    ).toBe(false);
  });

  it("rejects editEvents missing required fields", () => {
    expect(
      BehavioralSignalsSchema.safeParse({ editEvents: { deletes: 1 } }).success,
    ).toBe(false);
  });

  it("accepts both lastInputAt and editEvents together", () => {
    const result = BehavioralSignalsSchema.safeParse({
      lastInputAt: "2026-05-22T02:00:00.000Z",
      editEvents: { deletes: 2, redos: 1 },
    });
    expect(result.success).toBe(true);
  });
});

describe("SendMessageInputSchema — behavioralSignals (backward compat)", () => {
  const base = { sessionId: "clxxxxxxxxxxxxxxxxxxxxxxxx", content: "hello" };

  it("accepts payload without behavioralSignals (backward compatible)", () => {
    expect(SendMessageInputSchema.safeParse(base).success).toBe(true);
  });

  it("accepts payload with empty behavioralSignals", () => {
    const result = SendMessageInputSchema.safeParse({ ...base, behavioralSignals: {} });
    expect(result.success).toBe(true);
  });

  it("accepts payload with full behavioralSignals", () => {
    const result = SendMessageInputSchema.safeParse({
      ...base,
      behavioralSignals: {
        lastInputAt: "2026-05-22T02:00:00.000Z",
        editEvents: { deletes: 3, redos: 2 },
      },
    });
    expect(result.success).toBe(true);
  });

  it("rejects payload with invalid behavioralSignals", () => {
    const result = SendMessageInputSchema.safeParse({
      ...base,
      behavioralSignals: { lastInputAt: "bad-date" },
    });
    expect(result.success).toBe(false);
  });
});
