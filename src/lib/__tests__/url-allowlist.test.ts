import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { isAllowedStorageUrl } from "@/lib/url-allowlist";

describe("isAllowedStorageUrl", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_APP_URL: "http://localhost:3100",
      R2_PUBLIC_URL: "http://localhost:3100/api/storage",
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("allows URLs from the app origin", () => {
    expect(
      isAllowedStorageUrl("http://localhost:3100/api/storage/images/test.jpg"),
    ).toBe(true);
  });

  it("allows relative paths", () => {
    expect(isAllowedStorageUrl("/api/storage/images/test.jpg")).toBe(true);
    expect(isAllowedStorageUrl("/uploads/proof.jpg")).toBe(true);
  });

  it("rejects URLs from untrusted origins", () => {
    expect(isAllowedStorageUrl("http://evil.com/malware.jpg")).toBe(false);
    expect(
      isAllowedStorageUrl("https://attacker.example.com/phish.png"),
    ).toBe(false);
  });

  it("rejects empty strings", () => {
    expect(isAllowedStorageUrl("")).toBe(false);
    expect(isAllowedStorageUrl("  ")).toBe(false);
  });

  it("rejects non-string input", () => {
    expect(isAllowedStorageUrl(null as unknown as string)).toBe(false);
    expect(isAllowedStorageUrl(undefined as unknown as string)).toBe(false);
  });

  it("rejects invalid URLs", () => {
    expect(isAllowedStorageUrl("not-a-url")).toBe(false);
    expect(isAllowedStorageUrl("ftp://files.example.com/img.jpg")).toBe(false);
  });

  it("allows localhost:3100 by default", () => {
    expect(
      isAllowedStorageUrl("http://localhost:3100/uploads/photo.jpg"),
    ).toBe(true);
  });
});
