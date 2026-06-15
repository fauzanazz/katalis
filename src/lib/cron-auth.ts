import { timingSafeEqual } from "node:crypto";

/**
 * Authorize a cron request by constant-time comparison of the
 * `Authorization: Bearer ${CRON_SECRET}` header. Framework-agnostic — the
 * Nitro server route extracts the header and passes it here.
 *
 * Replaces the old Next-route helpers (reliability/auth.ts,
 * data-retention/auth.ts) which also accepted an admin session; cron endpoints
 * are now invoked only by Vercel Cron, so the bearer secret is the sole gate.
 */
export function isAuthorizedCronRequest(
  authHeader: string | null | undefined,
): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || !authHeader) return false;

  const provided = Buffer.from(authHeader);
  const expected = Buffer.from(`Bearer ${secret}`);
  // timingSafeEqual throws on length mismatch — guard first (length is not secret).
  if (provided.length !== expected.length) return false;
  return timingSafeEqual(provided, expected);
}
