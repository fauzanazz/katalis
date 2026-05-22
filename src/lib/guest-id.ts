import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

export const GUEST_ID_COOKIE = "katalis_guest_id";
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET must be at least 32 characters");
  }
  return secret;
}

function sign(value: string): string {
  return createHmac("sha256", getSecret()).update(value).digest("hex");
}

export function signGuestId(id: string): string {
  return `${id}.${sign(id)}`;
}

function safeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
  } catch {
    return false;
  }
}

function parseCookieHeader(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) return rest.join("=");
  }
  return null;
}

export function readGuestId(request: Request): string | null {
  const raw = parseCookieHeader(request.headers.get("cookie"), GUEST_ID_COOKIE);
  if (!raw) return null;
  const dotIndex = raw.lastIndexOf(".");
  if (dotIndex <= 0 || dotIndex === raw.length - 1) return null;
  const id = raw.slice(0, dotIndex);
  const tag = raw.slice(dotIndex + 1);
  const expected = sign(id);
  return safeEqualHex(tag, expected) ? id : null;
}

export interface ResolvedGuestId {
  id: string;
  setCookie: string | null;
}

function buildCookieHeader(signedValue: string): string {
  const attrs = [
    `${GUEST_ID_COOKIE}=${signedValue}`,
    "Path=/",
    `Max-Age=${COOKIE_MAX_AGE_SECONDS}`,
    "HttpOnly",
    "SameSite=Lax",
  ];
  if (process.env.NODE_ENV === "production") attrs.push("Secure");
  return attrs.join("; ");
}

export function resolveGuestId(request: Request): ResolvedGuestId {
  const existing = readGuestId(request);
  if (existing) return { id: existing, setCookie: null };
  const id = randomUUID();
  return { id, setCookie: buildCookieHeader(signGuestId(id)) };
}
