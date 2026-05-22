import { describe, it, expect, beforeEach, vi } from "vitest";

vi.stubEnv("SESSION_SECRET", "a".repeat(48));

import {
  GUEST_ID_COOKIE,
  readGuestId,
  signGuestId,
  resolveGuestId,
} from "../guest-id";

function makeReq(cookieValue?: string): Request {
  const headers: Record<string, string> = {};
  if (cookieValue) headers["cookie"] = `${GUEST_ID_COOKIE}=${cookieValue}`;
  return new Request("http://localhost:3100/x", { headers });
}

describe("guest-id", () => {
  beforeEach(() => vi.clearAllMocks());

  it("signGuestId produces value containing the id and an HMAC tag", () => {
    const signed = signGuestId("abc-123");
    expect(signed).toContain("abc-123");
    expect(signed).toContain(".");
    expect(signed.split(".").length).toBe(2);
  });

  it("readGuestId returns null when cookie absent", () => {
    expect(readGuestId(makeReq())).toBeNull();
  });

  it("readGuestId returns the id for a valid signed cookie", () => {
    const signed = signGuestId("guest-1");
    expect(readGuestId(makeReq(signed))).toBe("guest-1");
  });

  it("readGuestId rejects a forged cookie with tampered HMAC tag", () => {
    const signed = signGuestId("guest-1");
    const [id] = signed.split(".");
    const forged = `${id}.${"deadbeef".repeat(8)}`;
    expect(readGuestId(makeReq(forged))).toBeNull();
  });

  it("readGuestId rejects a cookie where the id was swapped under the original tag", () => {
    const signed = signGuestId("guest-1");
    const [, tag] = signed.split(".");
    const swapped = `guest-2.${tag}`;
    expect(readGuestId(makeReq(swapped))).toBeNull();
  });

  it("resolveGuestId returns existing id and no setCookie when cookie valid", () => {
    const signed = signGuestId("guest-1");
    const out = resolveGuestId(makeReq(signed));
    expect(out.id).toBe("guest-1");
    expect(out.setCookie).toBeNull();
  });

  it("resolveGuestId mints a new id with setCookie when cookie missing", () => {
    const out = resolveGuestId(makeReq());
    expect(out.id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(out.setCookie).not.toBeNull();
    expect(out.setCookie!).toContain(`${GUEST_ID_COOKIE}=`);
    expect(out.setCookie!.toLowerCase()).toContain("httponly");
    expect(out.setCookie!.toLowerCase()).toContain("samesite=lax");
  });

  it("resolveGuestId mints a new id when cookie HMAC is invalid", () => {
    const out = resolveGuestId(makeReq("forged.deadbeef"));
    expect(out.id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(out.setCookie).not.toBeNull();
  });
});
