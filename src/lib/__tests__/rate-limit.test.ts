import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    rateLimit: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

import { checkRateLimit } from "@/lib/rate-limit";
import { prisma } from "@/lib/db";

const mockPrisma = vi.mocked(prisma.rateLimit);

beforeEach(() => {
  vi.clearAllMocks();
  // Suppress random cleanup in tests
  vi.spyOn(Math, "random").mockReturnValue(1);
});

describe("checkRateLimit", () => {
  it("allows first request and creates new entry", async () => {
    mockPrisma.findUnique.mockResolvedValue(null);
    mockPrisma.upsert.mockResolvedValue({} as never);

    const result = await checkRateLimit("192.168.1.1", "login");

    expect(result.limited).toBe(false);
    expect(result.remaining).toBe(9);
    expect(mockPrisma.upsert).toHaveBeenCalledOnce();
  });

  it("allows requests within limit", async () => {
    const resetAt = new Date(Date.now() + 60000);
    mockPrisma.findUnique.mockResolvedValue({
      id: "1",
      identifier: "192.168.1.1",
      endpoint: "login",
      count: 5,
      resetAt,
    });
    mockPrisma.update.mockResolvedValue({} as never);

    const result = await checkRateLimit("192.168.1.1", "login");

    expect(result.limited).toBe(false);
    expect(result.remaining).toBe(4);
  });

  it("blocks requests over limit", async () => {
    const resetAt = new Date(Date.now() + 60000);
    mockPrisma.findUnique.mockResolvedValue({
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
    mockPrisma.findUnique.mockResolvedValue({
      id: "1",
      identifier: "192.168.1.1",
      endpoint: "login",
      count: 100,
      resetAt: expiredResetAt,
    });
    mockPrisma.upsert.mockResolvedValue({} as never);

    const result = await checkRateLimit("192.168.1.1", "login");

    expect(result.limited).toBe(false);
    expect(result.remaining).toBe(9);
    expect(mockPrisma.upsert).toHaveBeenCalledOnce();
  });

  it("separates endpoints independently", async () => {
    mockPrisma.findUnique.mockResolvedValue(null);
    mockPrisma.upsert.mockResolvedValue({} as never);

    await checkRateLimit("192.168.1.1", "login");
    await checkRateLimit("192.168.1.1", "register");

    expect(mockPrisma.upsert).toHaveBeenCalledTimes(2);
  });
});
