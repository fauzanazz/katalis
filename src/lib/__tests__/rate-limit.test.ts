import { describe, it, expect, vi, beforeEach } from "vitest";

const mockDb = vi.hoisted(() => ({
  query: {
    rateLimits: {
      findFirst: vi.fn(),
    },
  },
  insert: vi.fn(() => ({
    values: vi.fn(() => ({
      onConflictDoUpdate: vi.fn(() => ({
        returning: vi.fn().mockResolvedValue([]),
      })),
    })),
  })),
  update: vi.fn(() => ({
    set: vi.fn(() => ({
      where: vi.fn().mockResolvedValue(undefined),
    })),
  })),
  delete: vi.fn(() => ({
    where: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.mock("@/lib/db", () => ({ db: mockDb }));

import { checkRateLimit } from "@/lib/rate-limit";

beforeEach(() => {
  vi.clearAllMocks();
  // Suppress random cleanup in tests
  vi.spyOn(Math, "random").mockReturnValue(1);
});

describe("checkRateLimit", () => {
  it("allows first request and creates new entry", async () => {
    mockDb.query.rateLimits.findFirst.mockResolvedValue(null);

    const result = await checkRateLimit("192.168.1.1", "login");

    expect(result.limited).toBe(false);
    expect(result.remaining).toBe(9);
    expect(mockDb.insert).toHaveBeenCalledOnce();
  });

  it("allows requests within limit", async () => {
    const resetAt = new Date(Date.now() + 60000);
    mockDb.query.rateLimits.findFirst.mockResolvedValue({
      id: "1",
      identifier: "192.168.1.1",
      endpoint: "login",
      count: 5,
      resetAt,
    });

    const result = await checkRateLimit("192.168.1.1", "login");

    expect(result.limited).toBe(false);
    expect(result.remaining).toBe(4);
  });

  it("blocks requests over limit", async () => {
    const resetAt = new Date(Date.now() + 60000);
    mockDb.query.rateLimits.findFirst.mockResolvedValue({
      id: "1",
      identifier: "192.168.1.1",
      endpoint: "login",
      count: 10,
      resetAt,
    });

    const result = await checkRateLimit("192.168.1.1", "login");

    expect(result.limited).toBe(true);
    expect(result.remaining).toBe(0);
  });

  it("resets expired windows", async () => {
    const expiredResetAt = new Date(Date.now() - 1000);
    mockDb.query.rateLimits.findFirst.mockResolvedValue({
      id: "1",
      identifier: "192.168.1.1",
      endpoint: "login",
      count: 100,
      resetAt: expiredResetAt,
    });

    const result = await checkRateLimit("192.168.1.1", "login");

    expect(result.limited).toBe(false);
    expect(result.remaining).toBe(9);
    expect(mockDb.insert).toHaveBeenCalledOnce();
  });

  it("separates endpoints independently", async () => {
    mockDb.query.rateLimits.findFirst.mockResolvedValue(null);

    await checkRateLimit("192.168.1.1", "login");
    await checkRateLimit("192.168.1.1", "register");

    expect(mockDb.insert).toHaveBeenCalledTimes(2);
  });
});
