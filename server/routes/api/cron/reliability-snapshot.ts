import { defineEventHandler, getHeader, setResponseStatus } from "h3";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { runSnapshotJob } from "@/lib/reliability/service";

/**
 * Weekly reliability snapshot job (Vercel Cron). Auth: CRON_SECRET bearer only.
 * Replaces the deleted Next route src/app/api/admin/reliability/snapshot/route.ts
 * (the admin-session manual-trigger path was dropped — no Start UI invokes it).
 */
export default defineEventHandler(async (event) => {
  if (!isAuthorizedCronRequest(getHeader(event, "authorization"))) {
    setResponseStatus(event, 401);
    return { error: "unauthorized" };
  }

  const result = await runSnapshotJob("cron");
  return {
    triggeredBy: "cron",
    snapshotsCreated: result.snapshotsCreated,
    alertsCreated: result.alertsCreated,
  };
});
