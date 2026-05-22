/**
 * Auth helper for reliability API routes. Accepts either:
 *  - an authenticated admin session, OR
 *  - a matching CRON_SECRET passed as `Authorization: Bearer ${CRON_SECRET}`.
 *
 * Used by the snapshot endpoint that Vercel Cron hits without a browser session.
 */

import "server-only";
import type { NextRequest } from "next/server";
import { getAdminSession } from "@/lib/auth";

export type ReliabilityAuthResult =
  | { ok: true; via: "admin"; userId: string }
  | { ok: true; via: "cron" }
  | { ok: false; status: 401 | 403 };

export async function authorizeReliabilityRequest(
  request: NextRequest,
  { allowCronSecret = false }: { allowCronSecret?: boolean } = {},
): Promise<ReliabilityAuthResult> {
  if (allowCronSecret) {
    const header = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    if (header && cronSecret && header === `Bearer ${cronSecret}`) {
      return { ok: true, via: "cron" };
    }
  }

  const admin = await getAdminSession();
  if (admin) {
    return { ok: true, via: "admin", userId: admin.userId };
  }

  return { ok: false, status: 403 };
}
