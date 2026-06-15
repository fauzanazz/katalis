import { defineEventHandler, getHeader, setResponseStatus } from "h3";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { getStorageClient } from "@/lib/storage";

const GUEST_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Daily cleanup of stale guest uploads (Vercel Cron). Auth: CRON_SECRET bearer.
 * Logic moved verbatim from the deleted Next route
 * src/app/api/admin/storage/cleanup-guests/route.ts.
 */
export default defineEventHandler(async (event) => {
  if (!isAuthorizedCronRequest(getHeader(event, "authorization"))) {
    setResponseStatus(event, 401);
    return { error: "unauthorized" };
  }

  const storage = getStorageClient();
  const cutoff = new Date(Date.now() - GUEST_TTL_MS);

  const objects = await storage.listObjects("guest/");
  const stale = objects.filter((o) => o.lastModified < cutoff);

  await Promise.allSettled(stale.map((o) => storage.deleteFile(o.key)));

  return { deleted: stale.length };
});
