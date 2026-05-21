import { describe, expect, it, vi } from "vitest";

import { _submitMissionInterestRatingWithDeps } from "./explicit-rating-service";

function makeDeps() {
  return {
    upsertAssessment: vi.fn().mockResolvedValue({ id: "assessment-1" }),
    ingest: vi.fn().mockResolvedValue({ created: 1 }),
    auditEvent: vi.fn().mockResolvedValue({ id: "audit-1" }),
  };
}

describe("submitMissionInterestRating", () => {
  it("rejects non-integer rating", async () => {
    const deps = makeDeps();
    await expect(
      _submitMissionInterestRatingWithDeps(
        { childId: "child-1", missionId: "mission-1", interestKey: "science", rating: 3.5, rater: "parent" },
        deps,
      ),
    ).rejects.toThrow("rating must be integer 1..5");
  });

  it("rejects rating below 1", async () => {
    const deps = makeDeps();
    await expect(
      _submitMissionInterestRatingWithDeps(
        { childId: "child-1", missionId: "mission-1", interestKey: "science", rating: 0, rater: "child" },
        deps,
      ),
    ).rejects.toThrow("rating must be integer 1..5");
  });

  it("rejects rating above 5", async () => {
    const deps = makeDeps();
    await expect(
      _submitMissionInterestRatingWithDeps(
        { childId: "child-1", missionId: "mission-1", interestKey: "science", rating: 6, rater: "parent" },
        deps,
      ),
    ).rejects.toThrow("rating must be integer 1..5");
  });

  it("maps rating 1 to strength -0.8", async () => {
    const deps = makeDeps();
    await _submitMissionInterestRatingWithDeps(
      { childId: "child-1", missionId: "mission-1", interestKey: "art", rating: 1, rater: "parent" },
      deps,
    );
    expect(deps.ingest).toHaveBeenCalledWith(
      expect.objectContaining({ signals: [expect.objectContaining({ strength: -0.8 })] }),
    );
  });

  it("maps rating 2 to strength -0.3", async () => {
    const deps = makeDeps();
    await _submitMissionInterestRatingWithDeps(
      { childId: "child-1", missionId: "mission-1", interestKey: "art", rating: 2, rater: "parent" },
      deps,
    );
    expect(deps.ingest).toHaveBeenCalledWith(
      expect.objectContaining({ signals: [expect.objectContaining({ strength: -0.3 })] }),
    );
  });

  it("maps rating 3 to strength 0.1", async () => {
    const deps = makeDeps();
    await _submitMissionInterestRatingWithDeps(
      { childId: "child-1", missionId: "mission-1", interestKey: "art", rating: 3, rater: "parent" },
      deps,
    );
    expect(deps.ingest).toHaveBeenCalledWith(
      expect.objectContaining({ signals: [expect.objectContaining({ strength: 0.1 })] }),
    );
  });

  it("maps rating 4 to strength 0.6", async () => {
    const deps = makeDeps();
    await _submitMissionInterestRatingWithDeps(
      { childId: "child-1", missionId: "mission-1", interestKey: "art", rating: 4, rater: "child" },
      deps,
    );
    expect(deps.ingest).toHaveBeenCalledWith(
      expect.objectContaining({ signals: [expect.objectContaining({ strength: 0.6 })] }),
    );
  });

  it("maps rating 5 to strength 1.0", async () => {
    const deps = makeDeps();
    await _submitMissionInterestRatingWithDeps(
      { childId: "child-1", missionId: "mission-1", interestKey: "art", rating: 5, rater: "parent" },
      deps,
    );
    expect(deps.ingest).toHaveBeenCalledWith(
      expect.objectContaining({ signals: [expect.objectContaining({ strength: 1.0 })] }),
    );
  });

  it("child rater uses source explicit_child_rating and dimension joy", async () => {
    const deps = makeDeps();
    await _submitMissionInterestRatingWithDeps(
      { childId: "child-1", missionId: "mission-1", interestKey: "music", rating: 5, rater: "child" },
      deps,
    );
    expect(deps.ingest).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "explicit_child_rating",
        signals: [expect.objectContaining({ dimension: "joy" })],
      }),
    );
  });

  it("parent rater uses source explicit_parent_rating and dimension engagement", async () => {
    const deps = makeDeps();
    await _submitMissionInterestRatingWithDeps(
      { childId: "child-1", missionId: "mission-1", interestKey: "music", rating: 4, rater: "parent" },
      deps,
    );
    expect(deps.ingest).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "explicit_parent_rating",
        signals: [expect.objectContaining({ dimension: "engagement" })],
      }),
    );
  });

  it("upserts mission interest assessment", async () => {
    const deps = makeDeps();
    await _submitMissionInterestRatingWithDeps(
      { childId: "child-1", missionId: "mission-1", interestKey: "space", rating: 5, rater: "parent", notes: "Loves rockets" },
      deps,
    );
    expect(deps.upsertAssessment).toHaveBeenCalledWith(
      expect.objectContaining({
        childId: "child-1",
        missionId: "mission-1",
        interestKey: "space",
        notes: "Loves rockets",
      }),
    );
  });

  it("writes mission_interest_rating_submitted audit event", async () => {
    const deps = makeDeps();
    await _submitMissionInterestRatingWithDeps(
      { childId: "child-1", missionId: "mission-1", interestKey: "space", rating: 4, rater: "parent" },
      deps,
    );
    expect(deps.auditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        childId: "child-1",
        eventType: "mission_interest_rating_submitted",
      }),
    );
  });

  it("sets parentRating and explicitRating on assessment when rater is parent", async () => {
    const deps = makeDeps();
    await _submitMissionInterestRatingWithDeps(
      { childId: "child-1", missionId: "mission-1", interestKey: "nature", rating: 3, rater: "parent" },
      deps,
    );
    expect(deps.upsertAssessment).toHaveBeenCalledWith(
      expect.objectContaining({ explicitRating: 3, parentRating: 3, childRating: undefined }),
    );
  });

  it("sets childRating and explicitRating on assessment when rater is child", async () => {
    const deps = makeDeps();
    await _submitMissionInterestRatingWithDeps(
      { childId: "child-1", missionId: "mission-1", interestKey: "nature", rating: 5, rater: "child" },
      deps,
    );
    expect(deps.upsertAssessment).toHaveBeenCalledWith(
      expect.objectContaining({ explicitRating: 5, childRating: 5, parentRating: undefined }),
    );
  });
});
