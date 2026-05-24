import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/storage", () => ({
  getStorageClient: vi.fn(),
}));

vi.mock("@/lib/reliability/auth", () => ({
  authorizeReliabilityRequest: vi.fn(),
}));

import { POST } from "../route";
import { getStorageClient } from "@/lib/storage";
import { authorizeReliabilityRequest } from "@/lib/reliability/auth";
import { NextRequest } from "next/server";

const mockedGetStorageClient = vi.mocked(getStorageClient);
const mockedAuthorize = vi.mocked(authorizeReliabilityRequest);

function makeRequest(headers: Record<string, string> = {}): NextRequest {
  return new NextRequest("http://localhost/api/admin/storage/cleanup-guests", {
    method: "POST",
    headers,
  });
}

const now = new Date("2026-05-24T04:00:00Z");
const eightDaysAgo = new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000);
const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(now);
  vi.clearAllMocks();
});

describe("POST /api/admin/storage/cleanup-guests", () => {
  it("returns 401 with no auth", async () => {
    mockedAuthorize.mockResolvedValue({ ok: false, status: 401 });

    const res = await POST(makeRequest());

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toEqual({ error: "forbidden" });
  });

  it("returns 403 with wrong credentials", async () => {
    mockedAuthorize.mockResolvedValue({ ok: false, status: 403 });

    const res = await POST(makeRequest({ authorization: "Bearer wrong" }));

    expect(res.status).toBe(403);
  });

  it("deletes files older than 7 days", async () => {
    mockedAuthorize.mockResolvedValue({ ok: true, via: "cron" });

    const deleteFile = vi.fn().mockResolvedValue(undefined);
    const listObjects = vi.fn().mockResolvedValue([
      { key: "guest/abc/image/old.jpg", lastModified: eightDaysAgo },
      { key: "guest/abc/image/recent.jpg", lastModified: threeDaysAgo },
    ]);
    mockedGetStorageClient.mockReturnValue({
      listObjects,
      deleteFile,
    } as never);

    await POST(makeRequest({ authorization: `Bearer secret` }));

    expect(deleteFile).toHaveBeenCalledTimes(1);
    expect(deleteFile).toHaveBeenCalledWith("guest/abc/image/old.jpg");
  });

  it("keeps files newer than 7 days", async () => {
    mockedAuthorize.mockResolvedValue({ ok: true, via: "cron" });

    const deleteFile = vi.fn().mockResolvedValue(undefined);
    const listObjects = vi.fn().mockResolvedValue([
      { key: "guest/abc/image/recent.jpg", lastModified: threeDaysAgo },
    ]);
    mockedGetStorageClient.mockReturnValue({
      listObjects,
      deleteFile,
    } as never);

    await POST(makeRequest({ authorization: `Bearer secret` }));

    expect(deleteFile).not.toHaveBeenCalled();
  });

  it("returns deleted count", async () => {
    mockedAuthorize.mockResolvedValue({ ok: true, via: "cron" });

    const deleteFile = vi.fn().mockResolvedValue(undefined);
    const listObjects = vi.fn().mockResolvedValue([
      { key: "guest/a/image/1.jpg", lastModified: eightDaysAgo },
      { key: "guest/b/image/2.jpg", lastModified: eightDaysAgo },
      { key: "guest/c/image/3.jpg", lastModified: threeDaysAgo },
    ]);
    mockedGetStorageClient.mockReturnValue({
      listObjects,
      deleteFile,
    } as never);

    const res = await POST(makeRequest({ authorization: `Bearer secret` }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ deleted: 2 });
  });

  it("lists objects under guest/ prefix", async () => {
    mockedAuthorize.mockResolvedValue({ ok: true, via: "cron" });

    const deleteFile = vi.fn().mockResolvedValue(undefined);
    const listObjects = vi.fn().mockResolvedValue([]);
    mockedGetStorageClient.mockReturnValue({
      listObjects,
      deleteFile,
    } as never);

    await POST(makeRequest({ authorization: `Bearer secret` }));

    expect(listObjects).toHaveBeenCalledWith("guest/");
  });

  it("returns deleted: 0 when nothing is stale", async () => {
    mockedAuthorize.mockResolvedValue({ ok: true, via: "admin", userId: "admin-1" });

    const deleteFile = vi.fn().mockResolvedValue(undefined);
    const listObjects = vi.fn().mockResolvedValue([]);
    mockedGetStorageClient.mockReturnValue({
      listObjects,
      deleteFile,
    } as never);

    const res = await POST(makeRequest());
    const body = await res.json();

    expect(body).toEqual({ deleted: 0 });
  });
});
