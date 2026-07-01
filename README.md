# Huna AI (Katalis) — Discover, Act, Connect

A children's talent-discovery and development platform, built for **Agentic AI for Education**. Huna AI helps children uncover their interests through creative-artifact analysis, mentors them through a personalized 7-day quest with an AI companion, and connects young creators worldwide through a moderated, privacy-safe gallery — with a companion reporting layer for parents.

## Core Features

### 1. Talent Scout Agent
Upload a drawing, an audio recording, or try **Story Prompting** (the AI shows a few images and asks the child to tell a story about them). A single multimodal AI call analyzes the artifact and detects underlying interests beyond surface-level labels ("robot with detailed joints" → engineering interest, not just "drawing"). Results accumulate into a per-child interest profile over time rather than being trusted from any one upload.

### 2. Quest Buddy Agent
Once interests are detected, Quest Buddy generates a personalized **7-day quest** — one practical mission per day, using materials already at home — and mentors the child through it with Socratic dialogue calibrated to their developmental level (Zone of Proximal Development). A rule-based frustration engine watches for struggle and can offer a bounded mission simplification, but only the code decides when that's allowed — the model never changes the mission on its own.

### 3. Global Squad Gallery
Completed quest work can be shared into a moderated gallery, organized into interest-based "squads" rather than an open feed. No follower counts, no open chat, no personal info exposed — location is generalized to city/country level, and every entry passes a moderation gate before anyone else sees it.

### 4. Parent Bridge
An AI-generated progress report summarizes a child's activity — quests completed, badges earned, reflections written — into parent-friendly strengths, growth areas, and at-home tips, under a strict prompt constraint against fixed-trait labeling ("your child IS an engineer") in favor of behavior-in-progress framing.

## Key Properties

- **Access-code authentication** — children never hold a password or email; a parent-issued code attaches a child profile to a session
- **Trilingual UI** — Indonesian, English, and Chinese, with URL-based locale routing (`/id/…`, `/en/…`, `/zh/…`)
- **EXIF/location stripping** — all uploaded images are sanitized before storage or before being sent to any AI provider
- **XSS sanitization** — every user input is cleaned before storage
- **Provider-agnostic AI layer** — swap between OpenAI, Anthropic, Google, Grok, OpenRouter, NVIDIA, or Vertex AI per feature or modality; mock mode (`USE_MOCK_AI=true`) runs the whole app without real API keys
- **Moderation gate** — AI classification feeds a deterministic policy table (allow / block / flag-for-review); low-confidence results always route to a human reviewer
- **Bias monitoring** — a weekly reliability snapshot flags interest-detection results that skew heavily toward one locale or age band
- **Rate limiting** — built-in request throttling on sensitive endpoints

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | TanStack Start (React 19, file-based routing) on Vite 8 + Nitro 3 |
| Package manager | Bun |
| Database | Drizzle ORM + Turso (libSQL / serverless SQLite) |
| Styling | Tailwind CSS v4 + Radix UI primitives |
| Internationalization | Paraglide JS (id / en / zh) |
| AI providers | OpenAI, Anthropic, Google, Grok, OpenRouter, NVIDIA, Vertex AI — behind one internal interface |
| Object storage | Cloudflare R2 (presigned uploads) |
| Map | react-map-gl + MapLibre GL + Supercluster |
| Validation | Zod |
| Testing | Vitest + React Testing Library |
| Deployment | Vercel (Nitro's `vercel` preset) + Vercel Cron |

## Getting Started

### Prerequisites

- [Bun](https://bun.sh) ≥ 1.x

### Quick Setup

```bash
# 1. Install dependencies
bun install

# 2. Create environment file and fill in values (see table below)
cp .env.example .env   # if present — otherwise create .env manually

# 3. Push the Drizzle schema to your database
bun run db:push

# 4. Seed the database
bun run db:seed

# 5. Start the dev server (port 3101)
bun run dev
```

Open [http://localhost:3101](http://localhost:3101) in your browser.

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `AI_PROVIDER` | Active AI provider: `openai`, `anthropic`, `google`, `grok`, `openrouter`, `nvidia-text`, `nvidia-vision`, `vertex-ai` | `openai` |
| `AI_PROVIDER_IMAGE` / `AI_PROVIDER_AUDIO` / `AI_PROVIDER_MODERATION` | Optional per-modality provider overrides | falls back to `AI_PROVIDER` |
| `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` / `GOOGLE_AI_API_KEY` / etc. | API key for whichever provider(s) are configured | — |
| `USE_MOCK_AI` | Use deterministic mock AI responses instead of real API calls | `false` |
| `USE_MOCK_STORAGE` | Use local dev storage (writes to `public/uploads/`) instead of R2 | `false` |
| `TURSO_DATABASE_URL` / `DATABASE_URL` | Turso/libSQL connection string | — |
| `TURSO_AUTH_TOKEN` | Turso auth token | — |
| `CRON_SECRET` | 32-byte hex secret authorizing scheduled job routes (`openssl rand -hex 32`) | — |
| `R2_ACCOUNT_ID` / `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` / `R2_BUCKET_NAME` / `R2_PUBLIC_URL` | Cloudflare R2 storage config | — |
| `NEXT_PUBLIC_APP_URL` | Public app URL | `http://localhost:3101` |

## Scripts

```bash
bun run dev          # Dev server (vite dev, port 3101)
bun run build         # Production build (vite build → .output)
bun run start         # Run built server (node .output/server/index.mjs)
bun run preview       # Preview production build
bun run typecheck     # tsc --noEmit
bun run lint          # ESLint (flat config)
bun run test          # Run all tests (vitest run)
bun run test:watch    # Watch mode
bun run db:generate   # Generate a Drizzle migration
bun run db:migrate    # Apply migrations
bun run db:push       # Push schema directly (no migration)
bun run db:studio     # Drizzle Studio
bun run db:seed       # Seed the database
```

## Testing

**Important:** use `bun run test`, not `bun test` — the Vitest config (`vitest.config.mts`) and setup file (`vitest.setup.ts`, which polyfills `ResizeObserver`/`IntersectionObserver`/`matchMedia` and mocks `server-only`) are only loaded through the Vitest runner, not Bun's built-in test runner.

Currently: **519 of 520 tests pass** across 50 test files, scoped to library and type-level logic (decision-critical code — frustration scoring, ZPD-floor enforcement, interest scoring, AI-vs-human agreement tracking, bias monitoring). Server functions and route components are smoke-verified rather than unit-tested — see `docs/Technical-Implementation.docx` §3.8 for the full breakdown.

```bash
bun run test                    # Run all tests
bun run test src/lib/ai         # Run a specific folder
bun run test:watch              # Watch mode
```

## Project Structure

```
src/
├── router.tsx              # TanStack Router instance
├── start.tsx                # TanStack Start entry
├── routeTree.gen.ts         # Generated route tree — do not edit
├── routes/
│   └── $locale/              # File-based routes: home/discover/quest/gallery/login/register/parent/admin
├── components/
│   ├── start/                 # Current UI: chrome/, admin/, auth/, discovery/, gallery/, landing/, parent/, quest/, upload/
│   └── ui/                    # shadcn-style primitives on Radix UI
├── lib/
│   ├── ai/                    # Provider-agnostic AI client, providers/, mentor/, schemas
│   ├── interests/              # Taxonomy, profile aggregation, quest mapping
│   ├── moderation/              # Text + image moderation pipeline
│   ├── badges/                  # Badge engine + definitions
│   ├── age/, zpd/               # Age bands + ZPD scaffolding
│   ├── reliability/              # Kappa agreement tracking, bias monitoring
│   ├── squads/, parent/, privacy/, storage/
│   ├── server/                  # createServerFn modules (auth, quest, gallery, parent, admin-*, mentor, ...)
│   ├── db.ts                    # Drizzle client
│   └── schema.ts                 # Drizzle schema (all tables)
├── i18n/start-navigation.tsx     # LocaleLink / useLocaleRouter / useLocalePathname
└── paraglide/                     # Generated Paraglide runtime — do not edit
server/routes/api/cron/*.ts        # Nitro server routes → Vercel crons
messages/{en,id,zh}.json           # Paraglide translator source
drizzle/                            # Generated SQL migrations
docs/                                # Architecture docs, incl. Technical-Implementation.docx
```

## Documentation

See `docs/Technical-Implementation.docx` for the full technical architecture writeup — system diagrams, the AI orchestration model, per-feature model/method breakdown, database ER diagram, deployment topology, and an honest TRL assessment.

## License

Private — all rights reserved.
