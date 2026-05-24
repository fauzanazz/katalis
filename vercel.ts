import type { VercelConfig } from "@vercel/config/v1";

/**
 * Vercel project configuration.
 *
 * Crons listed here are picked up by Vercel and invoked on the production
 * deployment. The reliability snapshot endpoint accepts either an admin
 * session or `Authorization: Bearer ${CRON_SECRET}` — see
 * src/lib/reliability/auth.ts.
 *
 * CRON_SECRET must be configured in the Vercel project's environment
 * variables (Production scope) before this cron is useful. See
 * .env.example for the local convention and docs/plans/2026-05-22-reliability-kappa-design.md
 * §11 for the operational notes.
 */
const config: VercelConfig = {
  crons: [
    {
      path: "/api/admin/reliability/snapshot?triggeredBy=cron",
      schedule: "0 6 * * 1",
    },
    {
      path: "/api/admin/storage/cleanup-guests",
      schedule: "0 4 * * *",
    },
    {
      path: "/api/admin/data-retention/purge",
      schedule: "0 3 * * *",
    },
  ],
};

export default config;
