import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const SESSION_COOKIE_NAME = "katalis-session";
const SESSION_EXPIRY_DAYS = 7;

function getSecretKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET must be at least 32 characters");
  }
  return new TextEncoder().encode(secret);
}

export type SessionType = "child" | "user";

export interface SessionPayload {
  type: SessionType;
  childId?: string;
  userId?: string;
  role?: string;
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

async function setSessionCookie(payload: Omit<SessionPayload, "expiresAt">): Promise<void> {
  const expiresAt = new Date(
    Date.now() + SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
  );
  const session = await encrypt({
    ...payload,
    expiresAt: expiresAt.toISOString(),
  });
  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE_NAME, session, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    expires: expiresAt,
    sameSite: "lax",
    path: "/",
  });
}

export async function createChildSession(childId: string): Promise<void> {
  return setSessionCookie({ type: "child", childId });
}

export async function createUserSession(
  userId: string,
  role: string,
): Promise<void> {
  return setSessionCookie({ type: "user", userId, role });
}

export async function deleteSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  return decrypt(token);
}

/** Returns session if authenticated as a child (access code), otherwise null. */
export async function getChildSession(): Promise<{ childId: string } | null> {
  const session = await getSession();
  if (!session || session.type !== "child" || !session.childId) return null;
  return { childId: session.childId };
}

/** Returns session if authenticated as a user (email/password), otherwise null. */
export async function getUserSession(): Promise<{
  userId: string;
  role: string;
} | null> {
  const session = await getSession();
  if (!session || session.type !== "user" || !session.userId || !session.role)
    return null;
  return { userId: session.userId, role: session.role };
}

/** Returns user session if authenticated as admin, otherwise null. */
export async function getAdminSession(): Promise<{
  userId: string;
  role: string;
} | null> {
  const userSession = await getUserSession();
  if (!userSession || userSession.role !== "admin") return null;
  return userSession;
}

export { SESSION_COOKIE_NAME };
