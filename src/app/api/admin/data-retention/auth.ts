import "server-only";
import type { NextRequest } from "next/server";
import { getAdminSession } from "@/lib/auth";

export async function authorizeRetentionRequest(
  req: NextRequest,
): Promise<boolean> {
  const header = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (header && secret && header === `Bearer ${secret}`) return true;
  const admin = await getAdminSession();
  return !!admin;
}
