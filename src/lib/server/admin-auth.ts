import { createServerFn } from "@tanstack/react-start";
import { getAdminSession } from "@/lib/auth-start";

/**
 * Expose the admin session to client-reachable route guards (the admin layout
 * `beforeLoad`) over the createServerFn RPC boundary. Routes must NOT import
 * `@/lib/auth-start` directly: `beforeLoad`/`loader` run isomorphically, so a
 * direct import pulls server-only cookie APIs (setCookie) into the client
 * bundle and fails TanStack Start's import-protection at build.
 */
export const getAdminSessionFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ userId: string; role: string } | null> => {
    return getAdminSession();
  },
);
