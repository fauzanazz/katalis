import { createServerFn } from "@tanstack/react-start";
import { desc } from "drizzle-orm";
import { getAdminSession } from "@/lib/auth-start";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { ok, err, type Result } from "@/lib/server/result";

export type AdminUser = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  createdAt: string;
};

// Matches the original admin users page: a read-only table of ALL users sorted
// newest-first (the Next page did `findMany` with no limit). The legacy API
// route accepted page/limit but the page never used them, so pagination is
// dropped here for exact parity; revisit if the user table grows large.
export const listAdminUsersFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<Result<{ users: AdminUser[] }>> => {
    const admin = await getAdminSession();
    if (!admin) return err("unauthorized", "Admin access required");

    try {
      const rows = await db
        .select({
          id: users.id,
          email: users.email,
          name: users.name,
          role: users.role,
          createdAt: users.createdAt,
        })
        .from(users)
        .orderBy(desc(users.createdAt));

      const serialized: AdminUser[] = rows.map((u) => ({
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        createdAt: u.createdAt.toISOString(),
      }));

      return ok({ users: serialized });
    } catch (error) {
      console.error("Admin users fetch error:", error);
      return err("server_error", "Failed to fetch users");
    }
  },
);
