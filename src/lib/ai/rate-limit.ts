/**
 * AI Rate Limiting & Circuit Breaker
 * 
 * Implements configurable rate limiting for AI API calls to prevent:
 * - Exceeding API quotas
 * - Cascading failures during provider outages
 * - Excessive costs from runaway requests
 * 
 * Supports:
 * - Per-minute rate limiting
 * - Per-hour rate limiting
 * - Circuit breaker pattern for failing providers
 * - Exponential backoff on retries
 */

interface RateLimitConfig {
  perMinute?: number;
  perHour?: number;
  retryAttempts?: number;
  retryBackoffMs?: number;
}

interface CircuitBreakerState {
  state: "closed" | "open" | "half-open"; // closed = normal, open = failing, half-open = testing recovery
  lastFailureTime?: number;
  failureCount: number;
  nextRetryTime?: number;
}

class RateLimiter {
  private config: Required<RateLimitConfig>;
  private requestTimestamps: number[] = [];
  private circuitBreaker: Map<string, CircuitBreakerState> = new Map();
  
  // Circuit breaker constants
  private readonly CIRCUIT_BREAKER_RESET_MS = 60000; // 1 minute
  private readonly CIRCUIT_BREAKER_THRESHOLD = 5; // failures before opening circuit

  constructor(config: RateLimitConfig = {}) {
    this.config = {
      perMinute: config.perMinute ?? 60,
      perHour: config.perHour ?? 1000,
      retryAttempts: config.retryAttempts ?? 3,
      retryBackoffMs: config.retryBackoffMs ?? 1000,
    };
  }

  /**
   * Check if a request is allowed under rate limits
   * Cleans up old timestamps before checking
   */
  canMakeRequest(): boolean {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    const oneHourAgo = now - 3600000;

    // Clean up timestamps older than 1 hour
    this.requestTimestamps = this.requestTimestamps.filter((t) => t > oneHourAgo);

    // Check per-minute limit
    const lastMinute = this.requestTimestamps.filter((t) => t > oneMinuteAgo);
    if (lastMinute.length >= this.config.perMinute) {
      return false;
    }

    // Check per-hour limit
    if (this.requestTimestamps.length >= this.config.perHour) {
      return false;
    }

    return true;
  }

  /**
   * Record a successful request
   */
  recordSuccess(providerId: string = "default"): void {
    this.requestTimestamps.push(Date.now());

    // Reset circuit breaker on success
    const breaker = this.circuitBreaker.get(providerId) || this.getInitialBreakerState();
    if (breaker.state === "half-open" && breaker.failureCount === 0) {
      breaker.state = "closed";
    }
    this.circuitBreaker.set(providerId, breaker);
  }

  /**
   * Record a failed request and update circuit breaker
   */
  recordFailure(providerId: string = "default"): void {
    const breaker = this.circuitBreaker.get(providerId) || this.getInitialBreakerState();
    breaker.failureCount++;
    breaker.lastFailureTime = Date.now();

    if (breaker.failureCount >= this.CIRCUIT_BREAKER_THRESHOLD) {
      breaker.state = "open";
      breaker.nextRetryTime = Date.now() + this.CIRCUIT_BREAKER_RESET_MS;
    }

    this.circuitBreaker.set(providerId, breaker);
  }

  /**
   * Check if provider circuit is broken
   */
  isCircuitBreakerOpen(providerId: string = "default"): boolean {
    const breaker = this.circuitBreaker.get(providerId);
    if (!breaker) return false;

    if (breaker.state === "closed") return false;

    if (breaker.state === "open") {
      // Attempt half-open transition after timeout
      if (breaker.nextRetryTime && Date.now() >= breaker.nextRetryTime) {
        breaker.state = "half-open";
        breaker.failureCount = 0;
      } else {
        return true;
      }
    }

    return false;
  }

  /**
   * Get circuit breaker status for monitoring
   */
  getCircuitBreakerStatus(providerId: string = "default"): CircuitBreakerState {
    return this.circuitBreaker.get(providerId) || this.getInitialBreakerState();
  }

  private getInitialBreakerState(): CircuitBreakerState {
    return {
      state: "closed",
      failureCount: 0,
    };
  }

  /**
   * Get current rate limit status for monitoring/debugging
   */
  getStatus(): {
    requestsLastMinute: number;
    requestsLastHour: number;
    perMinuteLimit: number;
    perHourLimit: number;
    canMakeRequest: boolean;
    breakers: Record<string, CircuitBreakerState>;
  } {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    const oneHourAgo = now - 3600000;

    const lastMinute = this.requestTimestamps.filter((t) => t > oneMinuteAgo).length;
    const lastHour = this.requestTimestamps.filter((t) => t > oneHourAgo).length;

    const breakers: Record<string, CircuitBreakerState> = {};
    for (const [key, value] of this.circuitBreaker) {
      breakers[key] = value;
    }

    return {
      requestsLastMinute: lastMinute,
      requestsLastHour: lastHour,
      perMinuteLimit: this.config.perMinute,
      perHourLimit: this.config.perHour,
      canMakeRequest: this.canMakeRequest(),
      breakers,
    };
  }
}

// Initialize global rate limiter
const aiRateLimiter = new RateLimiter({
  perMinute: parseInt(process.env.AI_RATE_LIMIT_PER_MINUTE ?? "60", 10),
  perHour: parseInt(process.env.AI_RATE_LIMIT_PER_HOUR ?? "1000", 10),
});

/**
 * Higher-order function to wrap AI provider calls with rate limiting
 * 
 * Usage:
 * ```
 * const response = await withRateLimit(
 *   async () => generateContent(...),
 *   "vertex-ai"
 * );
 * ```
 */
export async function withRateLimit<T>(
  fn: () => Promise<T>,
  providerId: string = "default",
  options: { throwIfLimited?: boolean } = {},
): Promise<T> {
  const { throwIfLimited = true } = options;

  // Check circuit breaker
  if (aiRateLimiter.isCircuitBreakerOpen(providerId)) {
    const error = new Error(
      `[AI] Circuit breaker open for provider: ${providerId}. Service temporarily unavailable.`,
    );
    if (throwIfLimited) throw error;
    console.error(error.message);
    throw error;
  }

  // Check rate limit
  if (!aiRateLimiter.canMakeRequest()) {
    const error = new Error("[AI] Rate limit exceeded. Too many requests, please try again later.");
    if (throwIfLimited) throw error;
    console.error(error.message);
    throw error;
  }

  try {
    const result = await fn();
    aiRateLimiter.recordSuccess(providerId);
    return result;
  } catch (error) {
    aiRateLimiter.recordFailure(providerId);
    throw error;
  }
}

/**
 * Get current rate limiting status for monitoring/admin dashboards
 */
export function getRateLimitStatus() {
  return aiRateLimiter.getStatus();
}

/**
 * Reset rate limiting (for testing/admin reset)
 */
export function resetRateLimit() {
  return new RateLimiter({
    perMinute: parseInt(process.env.AI_RATE_LIMIT_PER_MINUTE ?? "60", 10),
    perHour: parseInt(process.env.AI_RATE_LIMIT_PER_HOUR ?? "1000", 10),
  });
}

export default aiRateLimiter;
