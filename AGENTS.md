# Clean Code Philosophy
Every line liability. Best code: no code.

- DRY: write twice = doing it wrong
- YAGNI: build only what's needed NOW
- KISS: complexity kills maintainability
- Readability > cleverness
- Self-documenting: names explain what, comments explain why. Always descriptive names, even in map/filter.
- Pure functions default; class only for shared mutable state or real polymorphism
- Compose > inherit
- Interface/type first; class only when behaviour + state need runtime instances
- Flag module >200 LOC or class >5 public methods as god object to split
- FP: short chains fine; avoid nested point-free puzzles

--- project-doc ---

# Stack

- Next.js 16 (App Router, React 19) — see `node_modules/next/dist/docs/` for the current API; do **not** rely on memorized older Next conventions.
- TypeScript strict, ESLint (Next vitals + TS), Vitest + jsdom + Testing Library.
- Prisma 6 (libSQL/Turso adapter) — schema at `prisma/schema.prisma`.
- next-intl (en/id/zh) — strings in `messages/*.json`; new UI copy goes in all three.
- Tailwind v4 + shadcn-style primitives. Light-mode only — `dark:` modifiers are banned by `src/app/__tests__/light-mode-only.test.ts`.
- Package manager: `bun`. Ask before npm/yarn/pip equivalents.

# Quickstart commands

| Task | Command |
|------|---------|
| Dev server | `bun run dev` (port 3100) |
| Typecheck | `bun run typecheck` |
| Lint | `bun run lint` |
| Unit tests | `bun run test` |
| Watch tests | `bun run test:watch` |
| Build | `bun run build` |
| Prisma migrate (dev) | `bun run db:migrate` |
| Prisma push (no migration) | `bun run db:push` |
| Seed | `bun prisma/seed.ts` |

Always run `typecheck`, `lint`, and `test` before claiming a task complete. Lint must finish with `0 errors`; warnings are tolerated and tracked.

# Repo map

```
src/
  app/[locale]/        # routed pages (App Router); login/discover/quest/gallery/parent/admin/home
  app/api/             # route handlers (route.ts); colocated __tests__/*.test.ts
  components/          # shared UI; layout/, parent/, quest/, discovery/, upload/, gallery/, ui/
  lib/
    ai/                # provider clients, schemas, mentor, quest helpers
    interests/         # taxonomy + parent insights + signal ingestion
    moderation/        # text + image moderation pipeline
    badges/            # badge engine + definitions
    age/, zpd/         # age bands + ZPD scaffolding
  i18n/                # next-intl navigation + locale config
  hooks/, types/       # shared hooks + types
messages/{en,id,zh}.json
prisma/                # schema, migrations, seed
vitest.{config.mts,setup.ts}
eslint.config.mjs
```

# UI feedback

- Never use `window.alert`, `window.confirm`, or `window.prompt`. Use `toast` from `sonner`.
- `import { toast } from "sonner"` — `<Toaster />` already mounts in the root layout.
- Variants: `toast()` info, `toast.success()`, `toast.error()`, `toast.warning()`.

# i18n

- All user-visible strings flow through `useTranslations` / `getTranslations`.
- When you add a key, add it to **all** of `messages/en.json`, `messages/id.json`, `messages/zh.json`.
- Locale routing uses `@/i18n/navigation` (`Link`, `useRouter`, `usePathname`). Don't import from `next/link` or `next/navigation` for app routes.

# Testing

- `vitest.setup.ts` polyfills `ResizeObserver`, `IntersectionObserver`, `window.matchMedia` for jsdom and mocks `server-only`. Add new polyfills there.
- Mock external boundaries (prisma, providers, auth, navigation) at the top of each test file. For prisma, mock the models actually touched by the route — including `childInterestProfile` for quest endpoints.
- For route handlers that lazily resolve providers (e.g. `@/lib/ai/mentor/chat`), mock `@/lib/interests/quest-mapper` and `@/lib/interests/ingest-service` alongside the AI client.
- When a hook's deps include something from a navigation hook, return a **stable object reference** in the mock so React's `useEffect` doesn't re-run forever. Pattern: `const stableRouter = { push: vi.fn(), ... }; useRouter: () => stableRouter`.
- Async server components must be awaited then rendered: `const ui = await NotFoundPage(); render(ui);`. Mock `next-intl/server`'s `getTranslations` accordingly.

# Lint notes

- `react-hooks/set-state-in-effect` is **warn**, not error. SSR-safe hydration patterns (`useEffect` → read `sessionStorage`/`localStorage` → `setState`) are intentional in this repo; new refactors should migrate to `useSyncExternalStore` over time.
- `react-hooks/static-components` flags `const Icon = lookup(name); <Icon />`. Use `React.createElement(iconComponent, props)` for dispatch-style icon picking.
- `react-hooks/purity` flags `Math.random()` (or any impurity) called during render — hoist generators to module scope.
- Unused vars are allowed when prefixed with `_`. Use `_error`, `_imageUrl`, etc. for params required by an interface but unused.

# Operations notes

- `CRON_SECRET` (32-byte hex) must be set in every environment that runs Vercel cron. The
  `/api/admin/reliability/snapshot` endpoint requires it for the weekly reliability snapshot
  job defined in `vercel.ts`. Generate with `openssl rand -hex 32`.
- AI provider selection is driven by `AI_PROVIDER` env (openai default; anthropic, google, vertex-ai, openrouter, nvidia, grok also supported). See `src/lib/ai/providers/` and `src/lib/ai/models.ts`.
- AI cost telemetry currently logs to console only — `src/lib/ai/cost-tracker.ts` has no DB persistence yet (no `AiUsageLog` Prisma model). Add the model + migration before re-enabling DB writes.

# OpenCode operating mode

Follow `opencode.md`: extension sprint, direct-first. Simple/local tasks are handled by main agent without subagent. Delegate only after delegation gate passes.
