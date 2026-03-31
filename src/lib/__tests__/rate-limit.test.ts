import { describe, it, expect, beforeEach } from "vitest";
import {
  isRateLimited,
  getRemainingAttempts,
  resetRateLimitStore,
} from "@/lib/rate-limit";

describe("rate-limit", () => {
  beforeEach(() => {
    resetRateLimitStore();
  });

  it("allows first request", () => {
    expect(isRateLimited("test-ip")).toBe(false);
  });

  it("allows requests within limit", () => {
    for (let i = 0; i < 10; i++) {
      expect(isRateLimited("test-ip")).toBe(false);
    }
  });

  it("blocks requests exceeding limit", () => {
    for (let i = 0; i < 10; i++) {
      isRateLimited("test-ip");
    }
    expect(isRateLimited("test-ip")).toBe(true);
  });

  it("tracks different IPs independently", () => {
    for (let i = 0; i < 10; i++) {
      isRateLimited("ip-a");
    }
    expect(isRateLimited("ip-a")).toBe(true);
    expect(isRateLimited("ip-b")).toBe(false);
  });

  it("getRemainingAttempts returns correct value", () => {
    expect(getRemainingAttempts("test-ip")).toBe(10);
    isRateLimited("test-ip");
    expect(getRemainingAttempts("test-ip")).toBe(9);
  });

  it("getRemainingAttempts returns 0 when exhausted", () => {
    for (let i = 0; i < 10; i++) {
      isRateLimited("test-ip");
    }
    expect(getRemainingAttempts("test-ip")).toBe(0);
  });
});
