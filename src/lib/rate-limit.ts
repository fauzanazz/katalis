/**
 * Simple in-memory rate limiter for auth endpoints.
 * Tracks attempts by IP address with a sliding window.
 *
 * ⚠️ In-memory rate limiting — only effective for single-instance deployments.
 * For production (e.g., Vercel serverless), replace with Vercel KV, Upstash,
 * or a distributed store.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

const MAX_ATTEMPTS = 10;
const WINDOW_MS = 60 * 1000; // 1 minute window

/**
 * Check if a request from the given identifier is rate limited.
 * @returns true if the request should be blocked
 */
export function isRateLimited(identifier: string): boolean {
  const now = Date.now();
  const entry = rateLimitStore.get(identifier);

  // Clean up expired entries periodically
  if (rateLimitStore.size > 10000) {
    for (const [key, val] of rateLimitStore) {
      if (val.resetAt <= now) {
        rateLimitStore.delete(key);
      }
    }
  }

  if (!entry || entry.resetAt <= now) {
    // Start new window
    rateLimitStore.set(identifier, {
      count: 1,
      resetAt: now + WINDOW_MS,
    });
    return false;
  }

  entry.count++;

  if (entry.count > MAX_ATTEMPTS) {
    return true;
  }

  return false;
}

/** Get remaining attempts for an identifier */
export function getRemainingAttempts(identifier: string): number {
  const now = Date.now();
  const entry = rateLimitStore.get(identifier);

  if (!entry || entry.resetAt <= now) {
    return MAX_ATTEMPTS;
  }

  return Math.max(0, MAX_ATTEMPTS - entry.count);
}

/** Reset rate limit store (for testing) */
export function resetRateLimitStore(): void {
  rateLimitStore.clear();
}
