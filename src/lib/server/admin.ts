/**
 * Admin vertical server functions (TanStack Start). Split by concern; this
 * barrel is the single import surface for admin routes/components:
 * `import { ... } from "@/lib/server/admin"`.
 *
 * NOTE: the 3 cron/maintenance endpoints (reliability/snapshot,
 * data-retention/purge, storage/cleanup-guests) are intentionally NOT here —
 * they must stay HTTP-callable by Vercel Cron (CRON_SECRET) and remain on
 * Next:3100 until Phase 5.
 */
export * from "./admin-auth";
export * from "./admin-stats";
export * from "./admin-codes";
export * from "./admin-moderation";
export * from "./admin-users";
export * from "./admin-reliability";
