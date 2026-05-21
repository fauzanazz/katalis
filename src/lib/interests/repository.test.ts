import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    interestSignal: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    childInterestProfile: {
      upsert: vi.fn(),
    },
    interestAuditEvent: {
      create: vi.fn(),
    },
    missionInterestAssessment: {
      upsert: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/db";
import {
  createInterestAuditEvent,
  createInterestSignal,
  listInterestSignalsForChild,
  upsertChildInterestProfile,
  upsertMissionInterestAssessment,
} from "./repository";

const mockPrisma = prisma as unknown as {
  interestSignal: {
    create: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
  };
  childInterestProfile: { upsert: ReturnType<typeof vi.fn> };
  interestAuditEvent: { create: ReturnType<typeof vi.fn> };
  missionInterestAssessment: { upsert: ReturnType<typeof vi.fn> };
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("interest repository", () => {
  it("creates clamped interest signals with taxonomy version", async () => {
    mockPrisma.interestSignal.create.mockResolvedValue({ id: "signal-1" } as never);
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

    expect(mockPrisma.interestSignal.create).toHaveBeenCalledWith({
      data: {
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
      },
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

    expect(mockPrisma.interestSignal.create).not.toHaveBeenCalled();
  });

  it("lists child signals newest first", async () => {
    mockPrisma.interestSignal.findMany.mockResolvedValue([] as never);

    await listInterestSignalsForChild("child-1");

    expect(mockPrisma.interestSignal.findMany).toHaveBeenCalledWith({
      where: { childId: "child-1" },
      orderBy: { observedAt: "desc" },
    });
  });

  it("clamps negative score to 0 in upsertChildInterestProfile", async () => {
    mockPrisma.childInterestProfile.upsert.mockResolvedValue({ id: "profile-neg" } as never);

    await upsertChildInterestProfile({
      childId: "child-1",
      interestKey: "art",
      score: -0.5,
      confidence: 0.8,
      signalCount: 1,
      trend: "falling",
    });

    expect(mockPrisma.childInterestProfile.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ score: 0 }),
        update: expect.objectContaining({ score: 0 }),
      }),
    );
  });

  it("upserts clamped child interest profiles", async () => {
    const lastSignalAt = new Date("2026-05-12T00:00:00.000Z");
    mockPrisma.childInterestProfile.upsert.mockResolvedValue({ id: "profile-1" } as never);

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

    expect(mockPrisma.childInterestProfile.upsert).toHaveBeenCalledWith({
      where: {
        childId_taxonomyVersion_interestKey: {
          childId: "child-1",
          taxonomyVersion: "v1",
          interestKey: "technology",
        },
      },
      create: {
        childId: "child-1",
        taxonomyVersion: "v1",
        interestKey: "technology",
        score: 1,
        confidence: 1,
        signalCount: 3,
        lastSignalAt,
        trend: "rising",
        summary: "Builds often",
      },
      update: {
        score: 1,
        confidence: 1,
        signalCount: 3,
        lastSignalAt,
        trend: "rising",
        summary: "Builds often",
      },
    });
  });

  it("creates interest audit events with JSON serialized to strings", async () => {
    mockPrisma.interestAuditEvent.create.mockResolvedValue({ id: "audit-1" } as never);

    await createInterestAuditEvent({
      childId: "child-1",
      actorUserId: "user-1",
      eventType: "interest_signals_ingested",
      entityType: "interest_signal",
      entityId: "signal-1",
      afterJson: { count: 1 },
    });

    expect(mockPrisma.interestAuditEvent.create).toHaveBeenCalledWith({
      data: {
        childId: "child-1",
        actorUserId: "user-1",
        eventType: "interest_signals_ingested",
        entityType: "interest_signal",
        entityId: "signal-1",
        beforeJson: undefined,
        afterJson: '{"count":1}',
        metadataJson: undefined,
      },
    });
  });

  it("serializes metadataJson in InterestSignal to string", async () => {
    mockPrisma.interestSignal.create.mockResolvedValue({ id: "signal-2" } as never);
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

    expect(mockPrisma.interestSignal.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          metadataJson: '{"questDay":1,"tags":["outdoor"]}',
        }),
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

    expect(mockPrisma.interestSignal.create).not.toHaveBeenCalled();
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

    expect(mockPrisma.interestSignal.create).not.toHaveBeenCalled();
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

    expect(mockPrisma.missionInterestAssessment.upsert).not.toHaveBeenCalled();
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

    expect(mockPrisma.missionInterestAssessment.upsert).not.toHaveBeenCalled();
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

    expect(mockPrisma.missionInterestAssessment.upsert).not.toHaveBeenCalled();
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

    expect(mockPrisma.missionInterestAssessment.upsert).not.toHaveBeenCalled();
  });

  it("accepts null ratings (clears them)", async () => {
    mockPrisma.missionInterestAssessment.upsert.mockResolvedValue({ id: "assessment-2" } as never);

    await upsertMissionInterestAssessment({
      childId: "child-1",
      missionId: "mission-1",
      interestKey: "art",
      explicitRating: null,
      parentRating: null,
    });

    expect(mockPrisma.missionInterestAssessment.upsert).toHaveBeenCalled();
  });

  it("upserts mission interest assessments", async () => {
    mockPrisma.missionInterestAssessment.upsert.mockResolvedValue({ id: "assessment-1" } as never);

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

    expect(mockPrisma.missionInterestAssessment.upsert).toHaveBeenCalledWith({
      where: {
        childId_missionId_interestKey: {
          childId: "child-1",
          missionId: "mission-1",
          interestKey: "art",
        },
      },
      create: {
        childId: "child-1",
        missionId: "mission-1",
        taxonomyVersion: "v1",
        interestKey: "art",
        explicitRating: 4,
        parentRating: 5,
        childRating: 3,
        observedEngagement: 4,
        notes: "Focused",
      },
      update: {
        explicitRating: 4,
        parentRating: 5,
        childRating: 3,
        observedEngagement: 4,
        notes: "Focused",
      },
    });
  });
});
