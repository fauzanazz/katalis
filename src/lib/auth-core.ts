/**
 * Framework-agnostic session core (jose JWT + session-mode derivation).
 *
 * No `next/headers`, no `server-only` (the latter throws outside Next's
 * react-server resolution, which TanStack Start does not set). Cookie I/O lives
 * in the per-framework adapters: `auth.ts` (Next, legacy) and `auth-start.ts`
 * (TanStack Start). Constants here MUST stay identical to `auth.ts` so a session
 * minted by one runtime is readable by the other during the migration.
 */
import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE_NAME = "katalis-session";
export const SESSION_EXPIRY_DAYS = 7;
export const STEP_UP_MAX_AGE_MS = 5 * 60 * 1000;

export function getSecretKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET must be at least 32 characters");
  }
  return new TextEncoder().encode(secret);
}

export type SessionMode = "parent" | "child";

export interface SessionPayload {
  /** Parent identity — present in BOTH parent and child mode. */
  userId?: string;
  role?: string;
  /** Set only while the parent is acting as a child. */
  activeChildId?: string;
  /** ISO timestamp of the last password re-auth (step-up). */
  stepUpAt?: string;
  expiresAt: string;
}

export async function encrypt(payload: SessionPayload): Promise<string> {
  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_EXPIRY_DAYS}d`)
    .sign(getSecretKey());
}

export async function decrypt(
  token: string | undefined,
): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecretKey(), {
      algorithms: ["HS256"],
    });
    return payload as unknown as SessionPayload;
  } catch (error) {
    console.warn("JWT verification failed:", (error as Error).message);
    return null;
  }
}

/** Build the JWT payload + matching cookie expiry for a fresh session write. */
export function buildSession(payload: Omit<SessionPayload, "expiresAt">): {
  payload: SessionPayload;
  expiresAt: Date;
} {
  const expiresAt = new Date(
    Date.now() + SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
  );
  return { payload: { ...payload, expiresAt: expiresAt.toISOString() }, expiresAt };
}

// --- pure session-mode derivations (operate on an already-decrypted payload) ---

/** Child identity when acting as a child, otherwise null. */
export function deriveChildSession(
  session: SessionPayload | null,
): { childId: string } | null {
  if (!session?.activeChildId) return null;
  return { childId: session.activeChildId };
}

/** Parent session ONLY in parent mode (no active child). */
export function deriveUserSession(
  session: SessionPayload | null,
): { userId: string; role: string } | null {
  if (!session?.userId || !session.role || session.activeChildId) return null;
  return { userId: session.userId, role: session.role };
}

/** Parent identity whenever present — in parent OR child mode. */
export function deriveParentIdentity(
  session: SessionPayload | null,
): { userId: string; role: string } | null {
  if (!session?.userId || !session.role) return null;
  return { userId: session.userId, role: session.role };
}

/** Parent session that is also an admin, otherwise null. */
export function deriveAdminSession(
  session: SessionPayload | null,
): { userId: string; role: string } | null {
  const user = deriveUserSession(session);
  if (!user || user.role !== "admin") return null;
  return user;
}

/** True if the payload carries a non-stale step-up stamp. */
export function isStepUpFreshForPayload(
  session: SessionPayload | null,
  maxAgeMs = STEP_UP_MAX_AGE_MS,
): boolean {
  if (!session?.stepUpAt) return false;
  const stampedAt = new Date(session.stepUpAt).getTime();
  if (Number.isNaN(stampedAt)) return false;
  return Date.now() - stampedAt <= maxAgeMs;
}
