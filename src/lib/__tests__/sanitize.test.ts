import { describe, it, expect } from "vitest";
import {
  sanitizeInput,
  containsSuspiciousPatterns,
  isValidAccessCodeFormat,
} from "@/lib/sanitize";

describe("sanitizeInput", () => {
  it("returns trimmed string for normal input", () => {
    expect(sanitizeInput("  KATAL-001  ")).toBe("KATAL-001");
  });

  it("strips HTML tags", () => {
    expect(sanitizeInput("<script>alert(1)</script>")).toBe("alert(1)");
  });

  it("strips img onerror XSS", () => {
    expect(sanitizeInput('<img src=x onerror=alert(1)>')).toBe("");
  });

  it("strips javascript: protocol", () => {
    expect(sanitizeInput("javascript:alert(1)")).toBe("alert(1)");
  });

  it("strips event handlers", () => {
    expect(sanitizeInput("onload=alert(1)")).toBe("alert(1)");
  });

  it("returns empty string for non-string input", () => {
    expect(sanitizeInput(null as unknown as string)).toBe("");
    expect(sanitizeInput(undefined as unknown as string)).toBe("");
    expect(sanitizeInput(123 as unknown as string)).toBe("");
  });
});

describe("containsSuspiciousPatterns", () => {
  it("detects script tags", () => {
    expect(containsSuspiciousPatterns("<script>alert(1)</script>")).toBe(true);
  });

  it("detects javascript: protocol", () => {
    expect(containsSuspiciousPatterns("javascript:alert(1)")).toBe(true);
  });

  it("detects event handlers", () => {
    expect(containsSuspiciousPatterns("onerror=alert(1)")).toBe(true);
  });

  it("detects eval calls", () => {
    expect(containsSuspiciousPatterns("eval('code')")).toBe(true);
  });

  it("returns false for normal input", () => {
    expect(containsSuspiciousPatterns("KATAL-001")).toBe(false);
  });

  it("returns false for non-string input", () => {
    expect(containsSuspiciousPatterns(null as unknown as string)).toBe(false);
  });
});

describe("isValidAccessCodeFormat", () => {
  it("accepts valid access codes", () => {
    expect(isValidAccessCodeFormat("KATAL-001")).toBe(true);
    expect(isValidAccessCodeFormat("KATAL-002")).toBe(true);
    expect(isValidAccessCodeFormat("KATAL-EXP")).toBe(true);
    expect(isValidAccessCodeFormat("ABC-123")).toBe(true);
  });

  it("rejects empty string", () => {
    expect(isValidAccessCodeFormat("")).toBe(false);
  });

  it("rejects strings with special characters", () => {
    expect(isValidAccessCodeFormat("'; DROP TABLE --")).toBe(false);
    expect(isValidAccessCodeFormat("<script>")).toBe(false);
    expect(isValidAccessCodeFormat("code with spaces")).toBe(false);
    expect(isValidAccessCodeFormat("code@#$")).toBe(false);
  });

  it("rejects strings longer than 50 chars", () => {
    expect(isValidAccessCodeFormat("A".repeat(51))).toBe(false);
  });

  it("rejects non-string input", () => {
    expect(isValidAccessCodeFormat(null as unknown as string)).toBe(false);
    expect(isValidAccessCodeFormat(undefined as unknown as string)).toBe(false);
  });
});
