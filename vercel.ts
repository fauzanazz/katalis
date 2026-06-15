import type { VercelConfig } from "@vercel/config/v1";

/**
 * Vercel project configuration.
 *
 * Crons listed here are picked up by Vercel and invoked on the production
 * deployment. They map to Nitro server routes at server/routes/api/cron/*.ts,
 * each authorized solely by `Authorization: Bearer ${CRON_SECRET}` — see
 * src/lib/cron-auth.ts.
 *
 * CRON_SECRET must be configured in the Vercel project's environment
 * variables (Production scope) before these crons are useful. See
 * .env.example for the local convention and docs/plans/2026-05-22-reliability-kappa-design.md
 * §11 for the operational notes.
 */
const config: VercelConfig = {
  // TanStack Start builds through Vite; the Nitro plugin auto-selects its
  // `vercel` preset when building on Vercel (the `VERCEL` env var is present)
  // and emits `.vercel/output` (Build Output API v3). `framework: null` stops
  // Vercel from applying a built-in preset (there is no longer a `next`
  // dependency to detect, and the generic Vite preset would wrongly assume a
  // static SPA instead of this SSR/Nitro server).
  buildCommand: "vite build",
  framework: null,
  crons: [
    {
      path: "/api/cron/reliability-snapshot",
      schedule: "0 6 * * 1",
    },
    {
      path: "/api/cron/cleanup-guests",
      schedule: "0 4 * * *",
    },
    {
      path: "/api/cron/data-retention-purge",
      schedule: "0 3 * * *",
    },
  ],
};

export default config;
