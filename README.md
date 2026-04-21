# Katalis — Discover, Act, Connect

A children's talent discovery and development platform powered by AI. Katalis helps children uncover hidden talents through creative artifact analysis, guides them with personalized 7-day quests, and connects young creators worldwide through an interactive global gallery.

## Three Pillars

### 1. Interest Discovery Agent
Upload a drawing, audio recording, or photo of a creation — or try **Story Prompting**, where the AI presents images and asks the child to tell a story. The agent performs multimodal analysis to detect underlying talents beyond surface-level categorisation.

### 2. Dream Catalyst Agent
Once talents are detected, the agent generates a **personalised 7-day quest** — one practical mission per day — tailored to the child's dream and local context. Materials are sourced from everyday household items, turning children from spectators into makers.

### 3. Global Squad Gallery
Completed quest works appear on an **interactive world map**, clustered by talent category. Children see peers from other countries who share similar interests, fostering global solidarity without the risks of open social features.

## Key Features

- **Access-code authentication** — no personal data collected from children
- **Bilingual UI** — Indonesian and English with URL-based locale routing (`/id/…`, `/en/…`)
- **EXIF metadata stripping** — all uploaded images are sanitised for privacy
- **XSS sanitisation** — every user input is cleaned before storage
- **AI mock layer** — toggle `USE_MOCK_AI=true` in `.env` to run without real API keys
- **Pin clustering** — gallery map groups entries by talent category using Supercluster
- **Rate limiting** — built-in request throttling on sensitive endpoints

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) + TypeScript |
| Package manager | Bun |
| Database | Prisma 6 + SQLite |
| Styling | Tailwind CSS 4 + shadcn/ui |
| Internationalisation | next-intl |
| AI – vision/analysis | OpenAI GPT-4o (mocked) |
| AI – quest generation & clustering | Anthropic Claude (mocked) |
| Map | react-map-gl + MapLibre GL |
| Validation | Zod |
| Testing | Vitest + React Testing Library |

## Getting Started

### Prerequisites

- [Bun](https://bun.sh) ≥ 1.x
- Node.js ≥ 18

### Quick Setup

```bash
# 1. Install dependencies
bun install

# 2. Create environment file
cp .env.example .env
# Or run the init script which creates .env with mock keys:
# bash .factory/init.sh

# 3. Generate Prisma client and push schema
bunx prisma generate
bunx prisma db push

# 4. Seed the database
bunx prisma db seed

# 5. Start the dev server (port 3100)
bun run dev
```

Open [http://localhost:3100](http://localhost:3100) in your browser.

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `OPENAI_API_KEY` | OpenAI API key (or mock value) | — |
| `ANTHROPIC_API_KEY` | Anthropic API key (or mock value) | — |
| `USE_MOCK_AI` | Use mock AI responses instead of real APIs | `true` |
| `DATABASE_URL` | SQLite database path | `file:./prisma/dev.db` |
| `NEXT_PUBLIC_MAPTILER_KEY` | MapTiler key for map tiles | — |
| `NEXT_PUBLIC_APP_URL` | Public app URL | `http://localhost:3100` |
| `R2_ACCOUNT_ID` | Cloudflare R2 account (mocked) | — |
| `R2_ACCESS_KEY_ID` | Cloudflare R2 access key (mocked) | — |
| `R2_SECRET_ACCESS_KEY` | Cloudflare R2 secret (mocked) | — |
| `R2_BUCKET_NAME` | R2 bucket name | `katalis-uploads` |
| `R2_PUBLIC_URL` | R2 public URL | — |

## Scripts

```bash
bun run dev        # Development server on port 3100
bun run build      # Production build
bun run test       # Run all tests (502 tests)
bun run typecheck  # TypeScript type checking
bun run lint       # ESLint
```

## Testing

**Important:** Always use `bun run test`, NOT `bun test`.

| Command | Runner | Config |
|---------|--------|--------|
| `bun run test` | Vitest | `vitest.config.mts` ✓ |
| `bun test` | Bun's built-in | Ignores vitest config ✗ |

This project uses **Vitest** with setup files that mock `server-only` and other Next.js internals. Running `bun test` directly bypasses the vitest config and will cause failures.

```bash
# Correct
bun run test                           # Run all tests
bun run test src/lib/ai                # Run specific folder
bun run test:watch                     # Watch mode

# Wrong — will fail
bun test
```

## Project Structure

```
src/
├── app/
│   ├── [locale]/          # Locale-based routing (id/en)
│   │   ├── dashboard/     # Child dashboard
│   │   ├── discover/      # Interest Discovery Agent
│   │   ├── gallery/       # Global Squad Gallery
│   │   ├── login/         # Access code login
│   │   └── quest/         # Dream Catalyst Agent
│   └── api/               # API routes
├── components/            # Shared UI components
├── hooks/                 # Custom React hooks
├── i18n/                  # Internationalisation config & messages
├── lib/
│   ├── ai/                # AI service layer (OpenAI, Claude, mocks)
│   ├── storage/           # File upload & EXIF stripping
│   ├── auth.ts            # Access code authentication
│   ├── sanitize.ts        # XSS sanitisation
│   └── rate-limit.ts      # Request rate limiting
├── proxy.ts               # Proxy utilities
└── types/                 # TypeScript type definitions
prisma/
├── schema.prisma          # Database schema
└── seed.ts                # Database seeder
```

## License

Private — all rights reserved.
