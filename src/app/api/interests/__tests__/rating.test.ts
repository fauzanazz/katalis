import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({
  getUserSession: vi.fn(),
  getChildSession: vi.fn(),
}));

vi.mock("@/lib/parent/link", () => ({
  verifyParentChildLink: vi.fn(),
}));

vi.mock("@/lib/interests/explicit-rating-service", () => ({
  submitMissionInterestRating: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    mission: { findFirst: vi.fn() },
  },
}));

import { POST } from "../rating/route";
import { getUserSession, getChildSession } from "@/lib/auth";
import { verifyParentChildLink } from "@/lib/parent/link";
import { submitMissionInterestRating } from "@/lib/interests/explicit-rating-service";
import { prisma } from "@/lib/db";

const mockedGetUserSession = vi.mocked(getUserSession);
const mockedGetChildSession = vi.mocked(getChildSession);
const mockedVerifyLink = vi.mocked(verifyParentChildLink);
const mockedSubmitRating = vi.mocked(submitMissionInterestRating);
const mockedMissionFindFirst = vi.mocked(prisma.mission.findFirst);

const validParentSession = { userId: "user-1", role: "user" };
// keep old alias for parent tests
const validSession = validParentSession;

function makeRequest(body: unknown) {
  return new Request("http://localhost:3100/api/interests/rating", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as Parameters<typeof POST>[0];
}

const validBody = {
  childId: "child-1",
  missionId: "mission-1",
  interestKey: "science",
  rating: 5,
  rater: "parent",
};

describe("POST /api/interests/rating", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when parent rater not authenticated", async () => {
    mockedGetUserSession.mockResolvedValue(null);

    const res = await POST(makeRequest(validBody));

    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe("unauthorized");
  });

  it("returns 400 for invalid JSON body", async () => {
    mockedGetUserSession.mockResolvedValue(validSession);

    const req = new Request("http://localhost:3100/api/interests/rating", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json",
    }) as unknown as Parameters<typeof POST>[0];

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 for missing childId", async () => {
    mockedGetUserSession.mockResolvedValue(validSession);

    const res = await POST(makeRequest({ ...validBody, childId: undefined }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("invalid");
  });

  it("returns 400 for missing missionId", async () => {
    mockedGetUserSession.mockResolvedValue(validSession);

    const res = await POST(makeRequest({ ...validBody, missionId: undefined }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("invalid");
  });

  it("returns 400 for invalid interestKey", async () => {
    mockedGetUserSession.mockResolvedValue(validSession);
    mockedVerifyLink.mockResolvedValue(true);
    mockedMissionFindFirst.mockResolvedValue({ id: "mission-1" } as never);

    const res = await POST(makeRequest({ ...validBody, interestKey: "not_a_valid_key" }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("invalid");
  });

  it("returns 400 for rating below 1", async () => {
    mockedGetUserSession.mockResolvedValue(validSession);

    const res = await POST(makeRequest({ ...validBody, rating: 0 }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("invalid");
  });

  it("returns 400 for rating above 5", async () => {
    mockedGetUserSession.mockResolvedValue(validSession);

    const res = await POST(makeRequest({ ...validBody, rating: 6 }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("invalid");
  });

  it("returns 400 for invalid rater", async () => {
    mockedGetUserSession.mockResolvedValue(validSession);

    const res = await POST(makeRequest({ ...validBody, rater: "admin" }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("invalid");
  });

  it("returns 403 when parent not linked to child", async () => {
    mockedGetUserSession.mockResolvedValue(validSession);
    mockedVerifyLink.mockResolvedValue(false);

    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toBe("forbidden");
  });

  it("returns 403 when mission does not belong to child (parent rater)", async () => {
    mockedGetUserSession.mockResolvedValue(validSession);
    mockedVerifyLink.mockResolvedValue(true);
    mockedMissionFindFirst.mockResolvedValue(null);

    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toBe("forbidden");
  });

  it("returns { ok: true } on success", async () => {
    mockedGetUserSession.mockResolvedValue(validSession);
    mockedVerifyLink.mockResolvedValue(true);
    mockedMissionFindFirst.mockResolvedValue({ id: "mission-1" } as never);
    mockedSubmitRating.mockResolvedValue(undefined);

    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
  });

  it("calls submitMissionInterestRating with correct args", async () => {
    mockedGetUserSession.mockResolvedValue(validSession);
    mockedVerifyLink.mockResolvedValue(true);
    mockedMissionFindFirst.mockResolvedValue({ id: "mission-1" } as never);
    mockedSubmitRating.mockResolvedValue(undefined);

    await POST(makeRequest({ ...validBody, notes: "Did it twice!" }));

    expect(mockedSubmitRating).toHaveBeenCalledWith({
      childId: "child-1",
      missionId: "mission-1",
      interestKey: "science",
      rating: 5,
      rater: "parent",
      notes: "Did it twice!",
    });
  });

  it("queries mission ownership with correct childId and missionId", async () => {
    mockedGetUserSession.mockResolvedValue(validSession);
    mockedVerifyLink.mockResolvedValue(true);
    mockedMissionFindFirst.mockResolvedValue({ id: "mission-1" } as never);
    mockedSubmitRating.mockResolvedValue(undefined);

    await POST(makeRequest(validBody));

    expect(mockedMissionFindFirst).toHaveBeenCalledWith({
      where: { id: "mission-1", quest: { childId: "child-1" } },
      select: { id: true },
    });
  });

  it("returns 401 when child rater not authenticated", async () => {
    mockedGetChildSession.mockResolvedValue(null);

    const res = await POST(makeRequest({ ...validBody, rater: "child" }));

    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe("unauthorized");
  });

  it("returns 403 when child rater uses wrong childId", async () => {
    mockedGetChildSession.mockResolvedValue({ childId: "child-other" });

    const res = await POST(makeRequest({ ...validBody, rater: "child" }));

    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toBe("forbidden");
  });

  it("returns 403 when mission does not belong to child (child rater)", async () => {
    mockedGetChildSession.mockResolvedValue({ childId: "child-1" });
    mockedMissionFindFirst.mockResolvedValue(null);

    const res = await POST(makeRequest({ ...validBody, rater: "child" }));

    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toBe("forbidden");
  });

  it("returns 200 when child rater authenticated with correct childId and mission owned", async () => {
    mockedGetChildSession.mockResolvedValue({ childId: "child-1" });
    mockedMissionFindFirst.mockResolvedValue({ id: "mission-1" } as never);
    mockedSubmitRating.mockResolvedValue(undefined);

    const res = await POST(makeRequest({ ...validBody, rater: "child" }));

    expect(mockedVerifyLink).not.toHaveBeenCalled();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
  });

  it("all valid rating values 1..5 succeed", async () => {
    mockedGetUserSession.mockResolvedValue(validSession);
    mockedVerifyLink.mockResolvedValue(true);
    mockedMissionFindFirst.mockResolvedValue({ id: "mission-1" } as never);
    mockedSubmitRating.mockResolvedValue(undefined);

    for (const rating of [1, 2, 3, 4, 5]) {
      const res = await POST(makeRequest({ ...validBody, rating }));
      expect(res.status).toBe(200);
    }
  });
});
