import { createServerFn } from "@tanstack/react-start";

import { getSession } from "@/lib/auth-start";

export interface AuthFlags {
  isAuthenticated: boolean;
  isAdmin: boolean;
  isParent: boolean;
  isChild: boolean;
}

/**
 * Role flags for the locale shell chrome, mirroring the Next `[locale]/layout`
 * logic. Resolved server-side from the session cookie.
 */
export const getAuthFlags = createServerFn({ method: "GET" }).handler(
  async (): Promise<AuthFlags> => {
    const session = await getSession();
    const isChild = !!session?.activeChildId;
    const isParent = !!session?.userId && !isChild;
    return {
      isChild,
      isParent,
      isAuthenticated: isChild || isParent,
      isAdmin: isParent && session?.role === "admin",
    };
  },
);
