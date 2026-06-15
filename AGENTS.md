# Clean Code Philosophy
Every line liability. Best code: no code.

- DRY: write twice = doing it wrong
- YAGNI: build only what's needed NOW
- KISS: complexity kills maintainability
- Readability > cleverness
- Self-documenting: names explain what, comments explain why. Descriptive names always, even in map/filter.
- Pure functions default; class only for shared mutable state or real polymorphism
- Compose > inherit
- Interface/type first; class only when behaviour + state need runtime instances
- Flag module >200 LOC or class >5 public methods as god object to split
- FP: short chains fine; avoid nested point-free puzzles

--- project-doc ---

# Stack

- **TanStack Start** (file-based routing via `@tanstack/react-router`, React 19) on **Vite 8** + **Nitro 3** (server build → `.output`). Migrated off Next.js — do **not** reintroduce `next`/`next-intl` imports or App-Router conventions. Router instance: `src/router.tsx`; Start entry: `src/start.tsx`; generated route tree: `src/routeTree.gen.ts` (**do not hand-edit**).
- TypeScript strict, ESLint **flat config** (`eslint.config.mjs`: `eslint-plugin-react-hooks` React-Compiler ruleset + `typescript-eslint` unused-vars; replaced `eslint-config-next`), Vitest + jsdom + Testing Library.
- Drizzle ORM (libSQL/Turso, `drizzle-kit`) — schema at `src/lib/schema.ts`, client at `src/lib/db.ts` (exports `db`), migrations in `drizzle/`. (Legacy `prisma/` dir is dead — not used.)
- **Paraglide JS** (en/id/zh) — runtime strings via `m` from `@/paraglide/messages`. Translator source of truth = `messages/{en,id,zh}.json` (nested); compiled to flat `messages/paraglide/{locale}.json` by `scripts/i18n-to-paraglide.ts`, then to `src/paraglide/` by the paraglide Vite plugin. `src/paraglide/` is **generated** — never edit by hand.
- Tailwind v4 via `@tailwindcss/vite` (no PostCSS) + shadcn-style primitives. Light-mode only — no `dark:` modifiers. (The enforcing test `light-mode-only.test.ts` was removed with `src/app/` during the cutover; convention still holds — restore a guard test if regressions appear.)
- Package manager: `bun`. Ask before npm/yarn/pip equivalents.

# Quickstart commands

| Task | Command |
|------|---------|
| Dev server | `bun run dev` (`vite dev`, port 3101) |
| Build | `bun run build` (`vite build` → `.output`) |
| Run built server | `bun run start` (`node .output/server/index.mjs`) |
| Preview build | `bun run preview` |
| Typecheck | `bun run typecheck` (`tsc --noEmit`) |
| Lint | `bun run lint` (`eslint`) |
| Unit tests | `bun run test` (`vitest run`) |
| Watch tests | `bun run test:watch` |
| Regenerate Paraglide messages | `bun scripts/i18n-to-paraglide.ts` |
| Drizzle generate migration | `bun run db:generate` |
| Drizzle migrate | `bun run db:migrate` |
| Drizzle push (no migration) | `bun run db:push` |
| Drizzle studio | `bun run db:studio` |
| Seed | `bun run db:seed` (`bun scripts/seed.ts`) |

Run `typecheck`, `lint`, `test` before claiming task complete. Lint must finish `0 errors`; warnings tolerated, tracked.

# Repo map

```
src/
  router.tsx           # TanStack Router instance (route tree + defaults)
  start.tsx            # TanStack Start entry
  routeTree.gen.ts     # GENERATED route tree — do not edit
  routes/
    __root.tsx         # root document: <head>, Toaster, catch/notFound boundaries, app.css
    $locale/           # file-based routes: home/discover/quest/gallery/login/register/parent/admin
  components/
    start/             # current TanStack UI: chrome (Header/Footer/LocaleShell/LanguageSwitcher/
                       #   GooeyNav/BackButton/Breadcrumbs/SkipToContent/Toaster/boundaries)
                       #   + feature dirs admin/, auth/, discovery/, gallery/, landing/, parent/,
                       #   quest/, upload/
    ui/                # shadcn-style primitives
    discovery/, landing/, layout/  # framework-agnostic shared bits kept from migration
  lib/
    ai/                # provider clients, schemas, mentor, quest helpers
    interests/         # taxonomy + parent insights + signal ingestion
    moderation/        # text + image moderation pipeline
    badges/            # badge engine + definitions
    age/, zpd/         # age bands + ZPD scaffolding
    discover/, parent/, privacy/, reliability/, squads/, storage/
    server/            # createServerFn modules (auth, gallery, quest, parent, admin-*, mentor, ...)
    auth-core.ts, auth-start.ts, auth-flags.ts, cron-auth.ts
    db.ts              # Drizzle client (exports `db`)
    schema.ts          # Drizzle schema (all tables)
  i18n/start-navigation.tsx   # LocaleLink / useLocaleRouter / useLocalePathname
  paraglide/           # GENERATED paraglide runtime + messages — do not edit
  hooks/, types/, styles/
server/routes/api/cron/*.ts   # Nitro server routes → Vercel crons (Start has no server-route API)
vite/dev-mock-storage.ts      # dev-only PUT /api/storage/upload/* middleware (apply: "serve")
messages/{en,id,zh}.json       # Paraglide translator source (nested)
messages/paraglide/{locale}.json  # GENERATED flat catalog (i18n-to-paraglide.ts output)
drizzle/               # generated SQL migrations + meta
drizzle.config.ts      # drizzle-kit config (turso dialect)
scripts/seed.ts        # DB seed
scripts/i18n-to-paraglide.ts   # messages/*.json → messages/paraglide/*.json
vite.config.mts        # Vite + tanstackStart + paraglide + tailwind + nitro + dev-mock-storage
vitest.{config.mts,setup.ts}
eslint.config.mjs
vercel.ts              # Vercel config (buildCommand vite build, crons)
project.inlang/        # Paraglide/inlang project config (baseLocale id; message paths)
public/                # static assets; public/uploads/ = dev mock-storage write target
```

# UI feedback

- Never use `window.alert`, `window.confirm`, `window.prompt`. Use `toast` from `sonner`.
- `import { toast } from "sonner"` — `<Toaster />` mounts in `src/routes/__root.tsx`.
- Variants: `toast()` info, `toast.success()`, `toast.error()`, `toast.warning()`.

# i18n

- All user-visible strings via Paraglide: `import { m } from "@/paraglide/messages"`, call as a function — `m.admin_users_title()`.
- `m` is a **named-export namespace** — it cannot be indexed by a template string. For dynamic key selection use an explicit `switch`/lookup (see `roleLabel` in `src/routes/$locale/admin/users/index.tsx`).
- New key → add to **all** `messages/en.json`, `messages/id.json`, `messages/zh.json` (nested format), then run `bun scripts/i18n-to-paraglide.ts` to regenerate the flat `messages/paraglide/*.json`. The paraglide Vite plugin recompiles `src/paraglide/` on dev/build. Nested namespaces flatten with `_` (e.g. `admin.users.title` → `m.admin_users_title`).
- Locale routing uses `@/i18n/start-navigation` (`LocaleLink`, `useLocaleRouter`, `useLocalePathname`). Don't import `next/link`/`next/navigation` (removed) or a raw `@tanstack/react-router` `Link` for locale-aware navigation. Locale resolution order: URL prefix (`/en`,`/id`,`/zh`) → cookie → base (`id`) — all locales are URL-prefixed (see `vite.config.mts` paraglide `urlPatterns`).

# Testing

- `vitest.setup.ts` polyfills `ResizeObserver`, `IntersectionObserver`, `window.matchMedia` for jsdom; mocks `server-only`. New polyfills go there.
- The suite is now **library/type unit tests** (`src/lib/**`, `src/types/**`, plus the framework-agnostic `src/components/landing/__tests__`). Route loaders and `createServerFn` server functions are **smoke-verified, not unit-tested** — an accepted coverage gap from the cutover; add unit tests as those modules evolve.
- Mock external boundaries (db, providers, storage) at the top of each test file. Mock the Drizzle client: `vi.mock("@/lib/db", () => ({ db: mockDb }))` — stub only the query chains the code touches (including the `childInterestProfile` table for quest logic).
- Server-fn modules lazily resolving providers (e.g. `@/lib/ai/mentor/chat`): mock `@/lib/interests/quest-mapper` + `@/lib/interests/ingest-service` alongside the AI client.
- When a hook depends on a navigation value, return a **stable object reference** in the mock so `useEffect` doesn't re-run forever. Pattern: `const stableRouter = { push: vi.fn(), ... }; useLocaleRouter: () => stableRouter`.

# Lint notes

- Flat config (`eslint.config.mjs`): `reactHooks.configs.flat.recommended` (React-Compiler ruleset) + `@typescript-eslint/no-unused-vars`. No more `eslint-config-next`.
- `react-hooks/set-state-in-effect` is **warn**, not error. SSR-safe hydration (`useEffect` → read `sessionStorage`/`localStorage` → `setState`) intentional here; new refactors migrate to `useSyncExternalStore` over time.
- `react-hooks/static-components` flags `const Icon = lookup(name); <Icon />`. Use `React.createElement(iconComponent, props)` for dispatch-style icon picking.
- `react-hooks/purity` flags `Math.random()` (or any impurity) during render — hoist generators to module scope.
- Unused vars allowed when prefixed `_`. Use `_error`, `_imageUrl`, etc. for interface-required params unused.

# Operations notes

- `CRON_SECRET` (32-byte hex) must be set in every env running Vercel cron. The cron endpoints are Nitro server routes at `server/routes/api/cron/{reliability-snapshot,cleanup-guests,data-retention-purge}.ts` (registered as crons in `vercel.ts`), each authorized by `Authorization: Bearer ${CRON_SECRET}` via `src/lib/cron-auth.ts` (timing-safe). Generate: `openssl rand -hex 32`.
- AI provider driven by `AI_PROVIDER` env (openai default; anthropic, google, vertex-ai, openrouter, nvidia, grok supported). See `src/lib/ai/providers/` and `src/lib/ai/models.ts`.
- AI cost telemetry logs to console only — `src/lib/ai/cost-tracker.ts` no DB persistence yet (no `aiUsageLog` table in `src/lib/schema.ts`). Add table + migration before re-enabling DB writes.
- Dev-only mock storage: `PUT /api/storage/upload/<key>` is handled by `vite/dev-mock-storage.ts` (Vite `apply: "serve"` middleware) when `USE_MOCK_STORAGE`/`USE_MOCK_AI` is set — writes to `public/uploads/`. Prod uploads go straight to R2 via presigned URLs; the middleware is excluded from `.output`.
- Deploy is Vercel; Nitro auto-selects its `vercel` preset on Vercel (emits `.vercel/output`). `vercel.ts` sets `buildCommand: "vite build"` + `framework: null`.

# OpenCode operating mode

Follow `opencode.md`: extension sprint, direct-first. Simple/local tasks handled by main agent without subagent. Delegate only after delegation gate passes.
