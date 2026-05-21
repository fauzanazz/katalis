import { describe, expect, it, vi } from "vitest";

import { _ingestInterestSignalsWithDeps } from "./ingest-service";

function makeDeps() {
  return {
    createSignal: vi.fn().mockResolvedValue({ id: "signal-1" }),
    auditEvent: vi.fn().mockResolvedValue({ id: "audit-1" }),
    rebuildProfiles: vi.fn().mockResolvedValue(undefined),
  };
}

describe("ingestInterestSignals", () => {
  it("is a no-op for empty signals array", async () => {
    const deps = makeDeps();
    const result = await _ingestInterestSignalsWithDeps(
      { childId: "child-1", source: "quest_completed", signals: [] },
      deps,
    );

    expect(result).toEqual({ created: 0 });
    expect(deps.createSignal).not.toHaveBeenCalled();
    expect(deps.auditEvent).not.toHaveBeenCalled();
    expect(deps.rebuildProfiles).not.toHaveBeenCalled();
  });

  it("creates one signal per entry", async () => {
    const deps = makeDeps();
    await _ingestInterestSignalsWithDeps(
      {
        childId: "child-1",
        source: "quest_completed",
        signals: [
          { interestKey: "science", dimension: "curiosity", strength: 0.7, confidence: 0.9 },
          { interestKey: "art", dimension: "joy", strength: 0.5 },
        ],
      },
      deps,
    );

    expect(deps.createSignal).toHaveBeenCalledTimes(2);
  });

  it("returns created count", async () => {
    const deps = makeDeps();
    const result = await _ingestInterestSignalsWithDeps(
      {
        childId: "child-1",
        source: "mission_completed",
        signals: [
          { interestKey: "space", dimension: "engagement", strength: 0.8 },
          { interestKey: "space", dimension: "persistence", strength: 0.6 },
          { interestKey: "building", dimension: "curiosity", strength: 0.4 },
        ],
      },
      deps,
    );

    expect(result).toEqual({ created: 3 });
  });

  it("writes interest_signals_ingested audit event", async () => {
    const deps = makeDeps();
    await _ingestInterestSignalsWithDeps(
      {
        childId: "child-1",
        source: "discovery_analysis",
        signals: [{ interestKey: "nature", dimension: "engagement", strength: 0.6 }],
      },
      deps,
    );

    expect(deps.auditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        childId: "child-1",
        eventType: "interest_signals_ingested",
      }),
    );
  });

  it("rebuilds profiles after ingestion", async () => {
    const deps = makeDeps();
    await _ingestInterestSignalsWithDeps(
      {
        childId: "child-1",
        source: "quest_started",
        signals: [{ interestKey: "music", dimension: "curiosity", strength: 0.3 }],
      },
      deps,
    );

    expect(deps.rebuildProfiles).toHaveBeenCalledWith("child-1", expect.any(Date));
  });

  it("passes context IDs to createSignal", async () => {
    const deps = makeDeps();
    await _ingestInterestSignalsWithDeps(
      {
        childId: "child-1",
        source: "quest_completed",
        questId: "quest-42",
        missionId: "mission-7",
        signals: [{ interestKey: "technology", dimension: "skill_growth", strength: 0.7 }],
      },
      deps,
    );

    expect(deps.createSignal).toHaveBeenCalledWith(
      expect.objectContaining({
        childId: "child-1",
        questId: "quest-42",
        missionId: "mission-7",
        source: "quest_completed",
        interestKey: "technology",
        dimension: "skill_growth",
        strength: 0.7,
      }),
    );
  });
});
