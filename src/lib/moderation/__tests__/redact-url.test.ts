import { describe, it, expect, vi } from "vitest";
import { redactChildUrl } from "../index";

vi.mock("@/lib/db", () => ({ db: {} }));

describe("redactChildUrl", () => {
  it("redacts childId from child/ URL", () => {
    const url = "https://r2.example.com/child/abc123xyz/image/foo.jpg";
    expect(redactChildUrl(url)).toBe(
      "https://r2.example.com/child/[REDACTED]/image/foo.jpg"
    );
  });

  it("redacts guestId from guest/ URL", () => {
    const url = "guest/abc123/audio/foo.mp3";
    expect(redactChildUrl(url)).toBe("guest/[REDACTED]/audio/foo.mp3");
  });

  it("returns original truncated to 80 chars when pattern not found", () => {
    const url = "https://r2.example.com/public/image/foo.jpg";
    expect(redactChildUrl(url)).toBe(url.slice(0, 80));
  });

  it("returns short URL as-is when no child path", () => {
    const url = "https://example.com/foo.jpg";
    expect(redactChildUrl(url)).toBe(url);
  });
});
