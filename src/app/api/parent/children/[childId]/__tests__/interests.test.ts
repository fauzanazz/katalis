import { describe, it, expect, vi, beforeEach } from "vitest";
import type { InterestKey } from "@/lib/interests/taxonomy";

vi.mock("@/lib/auth", () => ({
  getUserSession: vi.fn(),
}));

vi.mock("@/lib/parent/link", () => ({
  verifyParentChildLink: vi.fn(),
}));

vi.mock("@/lib/interests/parent-insight-service", () => ({
  getParentInterestInsights: vi.fn(),
}));

import { GET } from "../interests/route";
import { getUserSession } from "@/lib/auth";
import { verifyParentChildLink } from "@/lib/parent/link";
import { getParentInterestInsights } from "@/lib/interests/parent-insight-service";

const mockedGetUserSession = vi.mocked(getUserSession);
const mockedVerifyLink = vi.mocked(verifyParentChildLink);
const mockedGetInsights = vi.mocked(getParentInterestInsights);

const validSession = { userId: "user-1", role: "user" };

const mockInsights = {
  topInterests: [
    {
      interestKey: "science" as InterestKey,
      score: 0.8,
      confidence: 0.9,
      trend: "rising" as const,
      stability: "sustained" as const,
      signalCount: 5,
      distinctDays: 3,
      firstSignalAt: "2026-01-01T00:00:00.000Z",
      lastSignalAt: "2026-01-10T00:00:00.000Z",
      summary: null,
      recentEvidence: [],
    },
  ],
  recentSignals: [
    {
      interestKey: "science" as InterestKey,
      source: "quest_completed",
      dimension: "engagement",
      strength: 0.7,
      observedAt: "2026-01-10T00:00:00.000Z",
    },
  ],
  suggestedNextQuestions: ["What experiment would you want to do at home?"],
};

function makeGetRequest(childId: string) {
  return new Request(`http://localhost:3100/api/parent/children/${childId}/interests`, {
    method: "GET",
  }) as unknown as Parameters<typeof GET>[0];
}

describe("GET /api/parent/children/[childId]/interests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockedGetUserSession.mockResolvedValue(null);

    const res = await GET(makeGetRequest("child-1"), {
      params: Promise.resolve({ childId: "child-1" }),
    });

    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe("unauthorized");
  });

  it("returns 403 when parent not linked to child", async () => {
    mockedGetUserSession.mockResolvedValue(validSession);
    mockedVerifyLink.mockResolvedValue(false);

    const res = await GET(makeGetRequest("child-1"), {
      params: Promise.resolve({ childId: "child-1" }),
    });

    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toBe("forbidden");
  });

  it("returns insight data for linked parent-child", async () => {
    mockedGetUserSession.mockResolvedValue(validSession);
    mockedVerifyLink.mockResolvedValue(true);
    mockedGetInsights.mockResolvedValue(mockInsights);

    const res = await GET(makeGetRequest("child-1"), {
      params: Promise.resolve({ childId: "child-1" }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.topInterests).toHaveLength(1);
    expect(data.topInterests[0].interestKey).toBe("science");
    expect(data.recentSignals).toHaveLength(1);
    expect(data.suggestedNextQuestions).toHaveLength(1);
  });

  it("calls getParentInterestInsights with correct childId", async () => {
    mockedGetUserSession.mockResolvedValue(validSession);
    mockedVerifyLink.mockResolvedValue(true);
    mockedGetInsights.mockResolvedValue(mockInsights);

    await GET(makeGetRequest("child-abc"), {
      params: Promise.resolve({ childId: "child-abc" }),
    });

    expect(mockedGetInsights).toHaveBeenCalledWith("child-abc");
  });

  it("verifies link with correct userId and childId", async () => {
    mockedGetUserSession.mockResolvedValue(validSession);
    mockedVerifyLink.mockResolvedValue(true);
    mockedGetInsights.mockResolvedValue(mockInsights);

    await GET(makeGetRequest("child-1"), {
      params: Promise.resolve({ childId: "child-1" }),
    });

    expect(mockedVerifyLink).toHaveBeenCalledWith("user-1", "child-1");
  });

  it("returns 200 with empty arrays when no insights", async () => {
    mockedGetUserSession.mockResolvedValue(validSession);
    mockedVerifyLink.mockResolvedValue(true);
    mockedGetInsights.mockResolvedValue({
      topInterests: [],
      recentSignals: [],
      suggestedNextQuestions: [],
    });

    const res = await GET(makeGetRequest("child-1"), {
      params: Promise.resolve({ childId: "child-1" }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.topInterests).toEqual([]);
    expect(data.recentSignals).toEqual([]);
    expect(data.suggestedNextQuestions).toEqual([]);
  });
});
