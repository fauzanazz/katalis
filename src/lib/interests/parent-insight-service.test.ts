import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    childInterestProfile: {
      findMany: vi.fn(),
    },
    interestSignal: {
      findMany: vi.fn(),
    },
  },
}));

import { getParentInterestInsights } from "./parent-insight-service";
import { prisma } from "@/lib/db";

const mockedProfiles = vi.mocked(prisma.childInterestProfile.findMany);
const mockedSignals = vi.mocked(prisma.interestSignal.findMany);

function makeProfile(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "profile-1",
    childId: "child-1",
    taxonomyVersion: "v1",
    interestKey: "science",
    score: 0.8,
    confidence: 0.9,
    signalCount: 5,
    lastSignalAt: new Date("2026-01-10"),
    trend: "rising",
    summary: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeSignal(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "signal-1",
    childId: "child-1",
    taxonomyVersion: "v1",
    interestKey: "science",
    source: "quest_completed",
    dimension: "engagement",
    strength: 0.7,
    confidence: 0.8,
    discoveryId: null,
    questId: null,
    missionId: null,
    reflectionEntryId: null,
    galleryEntryId: null,
    metadataJson: null,
    observedAt: new Date("2026-01-10"),
    createdAt: new Date(),
    ...overrides,
  };
}

describe("getParentInterestInsights", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty topInterests and recentSignals for child with no data", async () => {
    mockedProfiles.mockResolvedValue([]);
    mockedSignals.mockResolvedValue([]);

    const result = await getParentInterestInsights("child-1");

    expect(result.topInterests).toEqual([]);
    expect(result.recentSignals).toEqual([]);
    expect(result.suggestedNextQuestions).toEqual([]);
  });

  it("returns topInterests with correct shape", async () => {
    mockedProfiles.mockResolvedValue([makeProfile()] as never);
    mockedSignals.mockResolvedValue([]);

    const result = await getParentInterestInsights("child-1");

    expect(result.topInterests).toHaveLength(1);
    const top = result.topInterests[0]!;
    expect(top.interestKey).toBe("science");
    expect(top.score).toBe(0.8);
    expect(top.confidence).toBe(0.9);
    expect(top.trend).toBe("rising");
    expect(top.signalCount).toBe(5);
    expect(top.lastSignalAt).toBe("2026-01-10T00:00:00.000Z");
    expect(top.summary).toBeNull();
  });

  it("returns recentSignals with correct shape", async () => {
    mockedProfiles.mockResolvedValue([]);
    mockedSignals.mockResolvedValue([makeSignal()] as never);

    const result = await getParentInterestInsights("child-1");

    expect(result.recentSignals).toHaveLength(1);
    const sig = result.recentSignals[0]!;
    expect(sig.interestKey).toBe("science");
    expect(sig.source).toBe("quest_completed");
    expect(sig.dimension).toBe("engagement");
    expect(sig.strength).toBe(0.7);
    expect(sig.observedAt).toBe("2026-01-10T00:00:00.000Z");
  });

  it("returns suggestedNextQuestions for top interests", async () => {
    mockedProfiles.mockResolvedValue([
      makeProfile({ interestKey: "science" }),
      makeProfile({ interestKey: "music", score: 0.7 }),
      makeProfile({ interestKey: "space", score: 0.6 }),
    ] as never);
    mockedSignals.mockResolvedValue([]);

    const result = await getParentInterestInsights("child-1");

    expect(result.suggestedNextQuestions).toHaveLength(3);
    for (const q of result.suggestedNextQuestions) {
      expect(typeof q).toBe("string");
      expect(q.length).toBeGreaterThan(0);
    }
  });

  it("normalizes unknown trend to stable", async () => {
    mockedProfiles.mockResolvedValue([makeProfile({ trend: "unknown_value" })] as never);
    mockedSignals.mockResolvedValue([]);

    const result = await getParentInterestInsights("child-1");

    expect(result.topInterests[0]!.trend).toBe("stable");
  });

  it("handles null lastSignalAt", async () => {
    mockedProfiles.mockResolvedValue([makeProfile({ lastSignalAt: null })] as never);
    mockedSignals.mockResolvedValue([]);

    const result = await getParentInterestInsights("child-1");

    expect(result.topInterests[0]!.lastSignalAt).toBeNull();
  });

  it("queries correct childId", async () => {
    mockedProfiles.mockResolvedValue([]);
    mockedSignals.mockResolvedValue([]);

    await getParentInterestInsights("child-xyz");

    expect(mockedProfiles).toHaveBeenCalledWith(
      expect.objectContaining({ where: { childId: "child-xyz" } }),
    );
    expect(mockedSignals).toHaveBeenCalledWith(
      expect.objectContaining({ where: { childId: "child-xyz" } }),
    );
  });

  it("limits topInterests to 10", async () => {
    mockedProfiles.mockResolvedValue([]);
    mockedSignals.mockResolvedValue([]);

    await getParentInterestInsights("child-1");

    expect(mockedProfiles).toHaveBeenCalledWith(
      expect.objectContaining({ take: 10 }),
    );
  });

  it("limits recentSignals to 20", async () => {
    mockedProfiles.mockResolvedValue([]);
    mockedSignals.mockResolvedValue([]);

    await getParentInterestInsights("child-1");

    expect(mockedSignals).toHaveBeenCalledWith(
      expect.objectContaining({ take: 20 }),
    );
  });

  it("skips profile rows with invalid interestKey", async () => {
    mockedProfiles.mockResolvedValue([
      makeProfile({ interestKey: "not_a_valid_key" }),
      makeProfile({ id: "profile-2", interestKey: "science" }),
    ] as never);
    mockedSignals.mockResolvedValue([]);

    const result = await getParentInterestInsights("child-1");

    expect(result.topInterests).toHaveLength(1);
    expect(result.topInterests[0]!.interestKey).toBe("science");
  });

  it("skips signal rows with invalid interestKey", async () => {
    mockedProfiles.mockResolvedValue([]);
    mockedSignals.mockResolvedValue([
      makeSignal({ interestKey: "garbage_key" }),
      makeSignal({ id: "signal-2", interestKey: "music" }),
    ] as never);

    const result = await getParentInterestInsights("child-1");

    expect(result.recentSignals).toHaveLength(1);
    expect(result.recentSignals[0]!.interestKey).toBe("music");
  });

  it("builds questions only from valid profile keys", async () => {
    mockedProfiles.mockResolvedValue([
      makeProfile({ interestKey: "invalid_key" }),
      makeProfile({ id: "profile-2", interestKey: "art", score: 0.7 }),
    ] as never);
    mockedSignals.mockResolvedValue([]);

    const result = await getParentInterestInsights("child-1");

    expect(result.suggestedNextQuestions).toHaveLength(1);
    expect(result.suggestedNextQuestions[0]).toContain("art");
  });
});
