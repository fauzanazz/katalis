import { describe, it, expect, beforeEach, vi } from "vitest";
import { getStorageClient, _resetStorageClient } from "../client";

// ---------------------------------------------------------------------------
// Env-based toggle tests
// ---------------------------------------------------------------------------

describe("getStorageClient", () => {
  beforeEach(() => {
    _resetStorageClient();
    vi.unstubAllEnvs();
  });

  it("returns mock client when USE_MOCK_AI=true", () => {
    vi.stubEnv("USE_MOCK_AI", "true");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3100");

    const client = getStorageClient();
    // The mock client generates local URLs
    const url = client.getPublicUrl("test/file.jpg");
    expect(url).toContain("localhost:3100/uploads/");
  });

  it("returns R2 client when USE_MOCK_AI is not 'true'", () => {
    vi.stubEnv("USE_MOCK_AI", "false");
    vi.stubEnv("R2_ACCOUNT_ID", "test-account");
    vi.stubEnv("R2_ACCESS_KEY_ID", "test-key");
    vi.stubEnv("R2_SECRET_ACCESS_KEY", "test-secret");
    vi.stubEnv("R2_BUCKET_NAME", "test-bucket");
    vi.stubEnv("R2_PUBLIC_URL", "https://cdn.example.com");

    const client = getStorageClient();
    const url = client.getPublicUrl("test/file.jpg");
    expect(url).toBe("https://cdn.example.com/test/file.jpg");
  });

  it("caches the client across multiple calls (singleton)", () => {
    vi.stubEnv("USE_MOCK_AI", "true");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3100");

    const client1 = getStorageClient();
    const client2 = getStorageClient();
    expect(client1).toBe(client2);
  });

  it("creates a new client after reset", () => {
    vi.stubEnv("USE_MOCK_AI", "true");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3100");

    const client1 = getStorageClient();
    _resetStorageClient();
    const client2 = getStorageClient();
    expect(client1).not.toBe(client2);
  });

  it("throws when R2 env vars are missing in non-mock mode", () => {
    vi.stubEnv("USE_MOCK_AI", "false");
    // Don't set any R2 env vars
    delete process.env.R2_ACCOUNT_ID;
    delete process.env.R2_ACCESS_KEY_ID;
    delete process.env.R2_SECRET_ACCESS_KEY;
    delete process.env.R2_BUCKET_NAME;
    delete process.env.R2_PUBLIC_URL;

    expect(() => getStorageClient()).toThrow(
      "Missing required environment variable",
    );
  });
});
