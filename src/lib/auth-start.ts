/**
 * TanStack Start session adapter. Mirrors the public API of the legacy Next
 * `auth.ts` but reads/writes cookies through the Start server runtime instead of
 * `next/headers`. Import this from server functions (`createServerFn().handler`)
 * and TanStack server routes. Phase 5 renames this to `auth.ts`.
 */
import {
  deleteCookie,
  getCookie,
  setCookie,
} from "@tanstack/react-start/server";

import {
  SESSION_COOKIE_NAME,
  STEP_UP_MAX_AGE_MS,
  buildSession,
  decrypt,
  deriveAdminSession,
  deriveChildSession,
  deriveParentIdentity,
  deriveUserSession,
  encrypt,
  isStepUpFreshForPayload,
  type SessionPayload,
} from "./auth-core";

export type { SessionMode, SessionPayload } from "./auth-core";
export { encrypt, decrypt, SESSION_COOKIE_NAME, STEP_UP_MAX_AGE_MS };

async function setSessionCookie(
  payload: Omit<SessionPayload, "expiresAt">,
): Promise<void> {
  const { payload: full, expiresAt } = buildSession(payload);
  const session = await encrypt(full);
  setCookie(SESSION_COOKIE_NAME, session, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    expires: expiresAt,
    sameSite: "lax",
    path: "/",
  });
}

export async function getSession(): Promise<SessionPayload | null> {
  return decrypt(getCookie(SESSION_COOKIE_NAME));
}

export async function createUserSession(
  userId: string,
  role: string,
): Promise<void> {
  return setSessionCookie({ userId, role });
}

export async function setActiveChild(childId: string): Promise<void> {
  const session = await getSession();
  if (!session?.userId) {
    throw new Error("Cannot set active child without a parent session");
  }
  return setSessionCookie({
    userId: session.userId,
    role: session.role,
    activeChildId: childId,
  });
}

export async function clearActiveChild(): Promise<void> {
  const session = await getSession();
  if (!session?.userId) {
    return deleteSession();
  }
  return setSessionCookie({ userId: session.userId, role: session.role });
}

export async function deleteSession(): Promise<void> {
  deleteCookie(SESSION_COOKIE_NAME, { path: "/" });
}

export async function getChildSession(): Promise<{ childId: string } | null> {
  return deriveChildSession(await getSession());
}

export async function getUserSession(): Promise<{
  userId: string;
  role: string;
} | null> {
  return deriveUserSession(await getSession());
}

export async function getParentIdentity(): Promise<{
  userId: string;
  role: string;
} | null> {
  return deriveParentIdentity(await getSession());
}

export async function getAdminSession(): Promise<{
  userId: string;
  role: string;
} | null> {
  return deriveAdminSession(await getSession());
}

export async function markStepUp(): Promise<void> {
  const session = await getSession();
  if (!session?.userId) {
    throw new Error("Cannot step up without a parent session");
  }
  return setSessionCookie({
    userId: session.userId,
    role: session.role,
    activeChildId: session.activeChildId,
    stepUpAt: new Date().toISOString(),
  });
}

export async function isStepUpFresh(
  maxAgeMs = STEP_UP_MAX_AGE_MS,
): Promise<boolean> {
  return isStepUpFreshForPayload(await getSession(), maxAgeMs);
}

export async function requireStepUp(
  maxAgeMs = STEP_UP_MAX_AGE_MS,
): Promise<Response | null> {
  if (await isStepUpFresh(maxAgeMs)) return null;
  return Response.json(
    {
      error: "step_up_required",
      message: "Password re-authentication required",
    },
    { status: 403 },
  );
}
