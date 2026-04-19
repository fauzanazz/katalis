import { prisma } from "@/lib/db";

const MAX_ATTEMPTS = 10;
const WINDOW_MS = 60 * 1000; // 1 minute

interface RateLimitResult {
  limited: boolean;
  remaining: number;
  resetAt: Date;
}

/**
 * Distributed rate limiter using Prisma (SQLite).
 * Works across all instances sharing the same database.
 */
export async function checkRateLimit(
  identifier: string,
  endpoint: string = "default",
): Promise<RateLimitResult> {
  const now = new Date();

  // Periodically clean up expired entries (1% chance per check)
  if (Math.random() < 0.01) {
    await prisma.rateLimit.deleteMany({
      where: { resetAt: { lt: now } },
    });
  }

  const existing = await prisma.rateLimit.findUnique({
    where: {
      identifier_endpoint: { identifier, endpoint },
    },
  });

  // No entry or expired window — start fresh
  if (!existing || existing.resetAt < now) {
    const resetAt = new Date(now.getTime() + WINDOW_MS);
    await prisma.rateLimit.upsert({
      where: {
        identifier_endpoint: { identifier, endpoint },
      },
      create: { identifier, endpoint, count: 1, resetAt },
      update: { count: 1, resetAt },
    });

    return { limited: false, remaining: MAX_ATTEMPTS - 1, resetAt };
  }

  // Active window — increment count
  const newCount = existing.count + 1;
  const limited = newCount > MAX_ATTEMPTS;

  if (!limited) {
    await prisma.rateLimit.update({
      where: {
        identifier_endpoint: { identifier, endpoint },
      },
      data: { count: newCount },
    });
  }

  return {
    limited,
    remaining: Math.max(0, MAX_ATTEMPTS - newCount),
    resetAt: existing.resetAt,
  };
}
