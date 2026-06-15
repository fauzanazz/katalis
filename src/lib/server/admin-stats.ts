import { createServerFn } from "@tanstack/react-start";
import { eq, inArray, count } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  users,
  children,
  accessCodes,
  discoveries,
  quests,
  galleryEntries,
  moderationEvents,
} from "@/lib/schema";
import { getAdminSession } from "@/lib/auth-start";
import { ok, err, type Result } from "@/lib/server/result";

interface PlatformStats {
  totalUsers: number;
  totalChildren: number;
  activeCodes: number;
  totalDiscoveries: number;
  totalQuests: number;
  totalGalleryEntries: number;
  pendingModeration: number;
}

export const getPlatformStatsFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<Result<PlatformStats>> => {
    const admin = await getAdminSession();
    if (!admin) return err("unauthorized", "Admin access required");

    const toCount = (rows: { count: number }[]) => rows[0]!.count;

    const [
      totalUsers,
      totalChildren,
      activeCodes,
      totalDiscoveries,
      totalQuests,
      totalGalleryEntries,
      pendingModeration,
    ] = await Promise.all([
      db.select({ count: count() }).from(users).then(toCount),
      db.select({ count: count() }).from(children).then(toCount),
      db
        .select({ count: count() })
        .from(accessCodes)
        .where(eq(accessCodes.active, true))
        .then(toCount),
      db.select({ count: count() }).from(discoveries).then(toCount),
      db.select({ count: count() }).from(quests).then(toCount),
      db.select({ count: count() }).from(galleryEntries).then(toCount),
      db
        .select({ count: count() })
        .from(moderationEvents)
        .where(inArray(moderationEvents.status, ["pending", "flagged"]))
        .then(toCount),
    ]);

    return ok({
      totalUsers,
      totalChildren,
      activeCodes,
      totalDiscoveries,
      totalQuests,
      totalGalleryEntries,
      pendingModeration,
    });
  },
);
