import { describe, expect, it, vi } from "vitest";

import { _rebuildChildInterestProfilesWithDeps } from "./profile-service";

function makeDeps() {
  return {
    listSignals: vi.fn(),
    upsertProfile: vi.fn().mockResolvedValue({ id: "profile-1" }),
    auditEvent: vi.fn().mockResolvedValue({ id: "audit-1" }),
  };
}

describe("rebuildChildInterestProfiles", () => {
  it("is a no-op when no signals exist", async () => {
    const deps = makeDeps();
    deps.listSignals.mockResolvedValue([]);

    await _rebuildChildInterestProfilesWithDeps("child-1", new Date(), deps);

    expect(deps.upsertProfile).not.toHaveBeenCalled();
    expect(deps.auditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "child_interest_profile_rebuilt" }),
    );
  });

  it("groups signals by interestKey and upserts one profile per key", async () => {
    const deps = makeDeps();
    const now = new Date();
    deps.listSignals.mockResolvedValue([
      { interestKey: "science", dimension: "engagement", strength: 0.8, confidence: 1, observedAt: now },
      { interestKey: "science", dimension: "joy", strength: 0.6, confidence: 0.9, observedAt: now },
      { interestKey: "art", dimension: "curiosity", strength: 0.5, confidence: 1, observedAt: now },
    ]);

    await _rebuildChildInterestProfilesWithDeps("child-1", now, deps);

    expect(deps.upsertProfile).toHaveBeenCalledTimes(2);
    const keys = deps.upsertProfile.mock.calls.map(
      (c: unknown[]) => (c[0] as { interestKey: string }).interestKey,
    );
    expect(keys).toContain("science");
    expect(keys).toContain("art");
  });

  it("writes child_interest_profile_rebuilt audit event", async () => {
    const deps = makeDeps();
    const now = new Date();
    deps.listSignals.mockResolvedValue([
      { interestKey: "space", dimension: "curiosity", strength: 0.7, confidence: 1, observedAt: now },
    ]);

    await _rebuildChildInterestProfilesWithDeps("child-1", now, deps);

    expect(deps.auditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        childId: "child-1",
        eventType: "child_interest_profile_rebuilt",
        entityType: "child_interest_profile",
      }),
    );
  });

  it("upserted profile has signalCount matching signal count per key", async () => {
    const deps = makeDeps();
    const now = new Date();
    deps.listSignals.mockResolvedValue([
      { interestKey: "music", dimension: "joy", strength: 0.5, confidence: 1, observedAt: now },
      { interestKey: "music", dimension: "engagement", strength: 0.8, confidence: 1, observedAt: now },
      { interestKey: "music", dimension: "persistence", strength: 0.6, confidence: 1, observedAt: now },
    ]);

    await _rebuildChildInterestProfilesWithDeps("child-1", now, deps);

    const call = deps.upsertProfile.mock.calls[0][0] as { signalCount: number };
    expect(call.signalCount).toBe(3);
  });

  it("upserted profile score is clamped between 0 and 1", async () => {
    const deps = makeDeps();
    const now = new Date();
    deps.listSignals.mockResolvedValue([
      { interestKey: "technology", dimension: "repeat_request", strength: 1, confidence: 1, observedAt: now },
      { interestKey: "technology", dimension: "persistence", strength: 1, confidence: 1, observedAt: now },
      { interestKey: "technology", dimension: "joy", strength: 1, confidence: 1, observedAt: now },
    ]);

    await _rebuildChildInterestProfilesWithDeps("child-1", now, deps);

    const call = deps.upsertProfile.mock.calls[0][0] as { score: number };
    expect(call.score).toBeGreaterThanOrEqual(0);
    expect(call.score).toBeLessThanOrEqual(1);
  });

  it("skips signals with unknown interestKey — no upsert for that key", async () => {
    const deps = makeDeps();
    const now = new Date();
    deps.listSignals.mockResolvedValue([
      { interestKey: "dinosaurs", dimension: "engagement", strength: 0.8, confidence: 1, observedAt: now },
      { interestKey: "science", dimension: "joy", strength: 0.6, confidence: 1, observedAt: now },
    ]);

    await _rebuildChildInterestProfilesWithDeps("child-1", now, deps);

    expect(deps.upsertProfile).toHaveBeenCalledTimes(1);
    const call = deps.upsertProfile.mock.calls[0][0] as { interestKey: string };
    expect(call.interestKey).toBe("science");
  });

  it("skips signals with unknown dimension — no upsert for that row", async () => {
    const deps = makeDeps();
    const now = new Date();
    deps.listSignals.mockResolvedValue([
      { interestKey: "art", dimension: "not_a_dimension", strength: 0.8, confidence: 1, observedAt: now },
    ]);

    await _rebuildChildInterestProfilesWithDeps("child-1", now, deps);

    expect(deps.upsertProfile).not.toHaveBeenCalled();
  });

  it("audit event includes skippedSignalCount", async () => {
    const deps = makeDeps();
    const now = new Date();
    deps.listSignals.mockResolvedValue([
      { interestKey: "bad_key", dimension: "engagement", strength: 0.5, confidence: 1, observedAt: now },
      { interestKey: "art", dimension: "bad_dim", strength: 0.5, confidence: 1, observedAt: now },
      { interestKey: "science", dimension: "curiosity", strength: 0.7, confidence: 1, observedAt: now },
    ]);

    await _rebuildChildInterestProfilesWithDeps("child-1", now, deps);

    expect(deps.auditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        metadataJson: expect.objectContaining({ skippedSignalCount: 2 }),
      }),
    );
  });
});
