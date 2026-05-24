import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockReturning, mockOnConflictDoUpdate, mockInsertValues, mockInsert, mockFindMany } =
  vi.hoisted(() => {
    const mockReturning = vi.fn();
    const mockOnConflictDoUpdate = vi.fn(() => ({ returning: mockReturning }));
    const mockInsertValues = vi.fn(() => ({
      returning: mockReturning,
      onConflictDoUpdate: mockOnConflictDoUpdate,
    }));
    const mockInsert = vi.fn(() => ({ values: mockInsertValues }));
    const mockFindMany = vi.fn();
    return { mockReturning, mockOnConflictDoUpdate, mockInsertValues, mockInsert, mockFindMany };
  });

vi.mock("@/lib/db", () => ({
  db: {
    insert: mockInsert,
    query: {
      interestSignals: { findMany: mockFindMany },
    },
  },
}));

import {
  createInterestAuditEvent,
  createInterestSignal,
  listInterestSignalsForChild,
  upsertChildInterestProfile,
  upsertMissionInterestAssessment,
} from "./repository";

type AnyRecord = Record<string, unknown>;

beforeEach(() => {
  vi.clearAllMocks();
  mockReturning.mockResolvedValue([{ id: "default-id" }]);
});

describe("interest repository", () => {
  it("creates clamped interest signals with taxonomy version", async () => {
    const observedAt = new Date("2026-05-12T00:00:00.000Z");

    await createInterestSignal({
      childId: "child-1",
      interestKey: "nature",
      source: "quest_completed",
      dimension: "joy",
      strength: 2,
      confidence: -1,
      metadataJson: { questDay: 1 },
      observedAt,
    });

    expect(mockInsertValues).toHaveBeenCalledWith({
      childId: "child-1",
      taxonomyVersion: "v1",
      interestKey: "nature",
      source: "quest_completed",
      dimension: "joy",
      strength: 1,
      confidence: 0,
      discoveryId: undefined,
      questId: undefined,
      missionId: undefined,
      reflectionEntryId: undefined,
      galleryEntryId: undefined,
      metadataJson: '{"questDay":1}',
      observedAt,
    });
  });

  it("rejects unknown interest keys", async () => {
    await expect(
      createInterestSignal({
        childId: "child-1",
        interestKey: "dinosaurs" as never,
        source: "quest_completed",
        dimension: "joy",
        strength: 0.5,
      }),
    ).rejects.toThrow("Unknown interest key: dinosaurs");

    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("lists child signals newest first", async () => {
    mockFindMany.mockResolvedValue([]);

    await listInterestSignalsForChild("child-1");

    expect(mockFindMany).toHaveBeenCalledOnce();
    const callArg = (mockFindMany.mock.calls as AnyRecord[][])[0]?.[0] as AnyRecord;
    expect(callArg).toHaveProperty("where");
    expect(callArg).toHaveProperty("orderBy");
  });

  it("clamps negative score to 0 in upsertChildInterestProfile", async () => {
    await upsertChildInterestProfile({
      childId: "child-1",
      interestKey: "art",
      score: -0.5,
      confidence: 0.8,
      signalCount: 1,
      trend: "falling",
    });

    const valuesArg = (mockInsertValues.mock.calls as AnyRecord[][])[0]?.[0] as AnyRecord;
    expect(valuesArg["score"]).toBe(0);

    const onConflictArg = (mockOnConflictDoUpdate.mock.calls as AnyRecord[][])[0]?.[0] as AnyRecord;
    expect((onConflictArg["set"] as AnyRecord)["score"]).toBe(0);
  });

  it("upserts clamped child interest profiles", async () => {
    const lastSignalAt = new Date("2026-05-12T00:00:00.000Z");

    await upsertChildInterestProfile({
      childId: "child-1",
      interestKey: "technology",
      score: 1.7,
      confidence: 2,
      signalCount: 3,
      lastSignalAt,
      trend: "rising",
      summary: "Builds often",
    });

    expect(mockInsertValues).toHaveBeenCalledWith({
      childId: "child-1",
      taxonomyVersion: "v1",
      interestKey: "technology",
      score: 1,
      confidence: 1,
      signalCount: 3,
      distinctDays: 0,
      firstSignalAt: undefined,
      lastSignalAt,
      trend: "rising",
      stability: "fleeting",
      summary: "Builds often",
    });

    const onConflictArg = (mockOnConflictDoUpdate.mock.calls as AnyRecord[][])[0]?.[0] as AnyRecord;
    expect(onConflictArg["set"]).toEqual({
      score: 1,
      confidence: 1,
      signalCount: 3,
      distinctDays: 0,
      firstSignalAt: undefined,
      lastSignalAt,
      trend: "rising",
      stability: "fleeting",
      summary: "Builds often",
    });
  });

  it("creates interest audit events with JSON serialized to strings", async () => {
    await createInterestAuditEvent({
      childId: "child-1",
      actorUserId: "user-1",
      eventType: "interest_signals_ingested",
      entityType: "interest_signal",
      entityId: "signal-1",
      afterJson: { count: 1 },
    });

    expect(mockInsertValues).toHaveBeenCalledWith({
      childId: "child-1",
      actorUserId: "user-1",
      eventType: "interest_signals_ingested",
      entityType: "interest_signal",
      entityId: "signal-1",
      beforeJson: undefined,
      afterJson: '{"count":1}',
      metadataJson: undefined,
    });
  });

  it("serializes metadataJson in InterestSignal to string", async () => {
    const observedAt = new Date("2026-05-12T00:00:00.000Z");

    await createInterestSignal({
      childId: "child-1",
      interestKey: "nature",
      source: "quest_completed",
      dimension: "joy",
      strength: 0.5,
      metadataJson: { questDay: 1, tags: ["outdoor"] },
      observedAt,
    });

    expect(mockInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        metadataJson: '{"questDay":1,"tags":["outdoor"]}',
      }),
    );
  });

  it("rejects cyclic metadataJson with clear error", async () => {
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;

    await expect(
      createInterestSignal({
        childId: "child-1",
        interestKey: "nature",
        source: "quest_completed",
        dimension: "joy",
        strength: 0.5,
        metadataJson: cyclic,
      }),
    ).rejects.toThrow("metadataJson is not JSON-serializable");

    // db.insert() is called before values() argument is evaluated; values() is never reached
    expect(mockInsertValues).not.toHaveBeenCalled();
  });

  it("rejects BigInt in metadataJson with clear error", async () => {
    await expect(
      createInterestSignal({
        childId: "child-1",
        interestKey: "nature",
        source: "quest_completed",
        dimension: "joy",
        strength: 0.5,
        metadataJson: { big: BigInt(9007199254740991) },
      }),
    ).rejects.toThrow("metadataJson is not JSON-serializable");

    expect(mockInsertValues).not.toHaveBeenCalled();
  });

  it("rejects rating < 1 in upsertMissionInterestAssessment", async () => {
    await expect(
      upsertMissionInterestAssessment({
        childId: "child-1",
        missionId: "mission-1",
        interestKey: "art",
        explicitRating: 0,
      }),
    ).rejects.toThrow("explicitRating must be an integer between 1 and 5");

    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("rejects rating > 5 in upsertMissionInterestAssessment", async () => {
    await expect(
      upsertMissionInterestAssessment({
        childId: "child-1",
        missionId: "mission-1",
        interestKey: "art",
        parentRating: 6,
      }),
    ).rejects.toThrow("parentRating must be an integer between 1 and 5");

    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("rejects non-integer rating in upsertMissionInterestAssessment", async () => {
    await expect(
      upsertMissionInterestAssessment({
        childId: "child-1",
        missionId: "mission-1",
        interestKey: "art",
        childRating: 3.5,
      }),
    ).rejects.toThrow("childRating must be an integer between 1 and 5");

    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("rejects invalid observedEngagement in upsertMissionInterestAssessment", async () => {
    await expect(
      upsertMissionInterestAssessment({
        childId: "child-1",
        missionId: "mission-1",
        interestKey: "art",
        observedEngagement: 10,
      }),
    ).rejects.toThrow("observedEngagement must be an integer between 1 and 5");

    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("accepts null ratings (clears them)", async () => {
    await upsertMissionInterestAssessment({
      childId: "child-1",
      missionId: "mission-1",
      interestKey: "art",
      explicitRating: null,
      parentRating: null,
    });

    expect(mockInsert).toHaveBeenCalled();
  });

  it("upserts mission interest assessments", async () => {
    await upsertMissionInterestAssessment({
      childId: "child-1",
      missionId: "mission-1",
      interestKey: "art",
      explicitRating: 4,
      parentRating: 5,
      childRating: 3,
      observedEngagement: 4,
      notes: "Focused",
    });

    expect(mockInsertValues).toHaveBeenCalledWith({
      childId: "child-1",
      missionId: "mission-1",
      taxonomyVersion: "v1",
      interestKey: "art",
      explicitRating: 4,
      parentRating: 5,
      childRating: 3,
      observedEngagement: 4,
      notes: "Focused",
    });

    const onConflictArg = (mockOnConflictDoUpdate.mock.calls as AnyRecord[][])[0]?.[0] as AnyRecord;
    expect(onConflictArg["set"]).toEqual({
      explicitRating: 4,
      parentRating: 5,
      childRating: 3,
      observedEngagement: 4,
      notes: "Focused",
    });
  });
});
