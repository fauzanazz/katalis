# User Testing Library — Katalis

## Validation Surface

- **Primary surface:** Browser UI at http://localhost:3100
- **Tool:** agent-browser skill
- **Secondary surface:** API endpoints at http://localhost:3100/api/*
- **Tool:** curl
- **URL-based i18n routing:** Pages are at /en/* (English) and /id/* (Indonesian)
- **Auth:** Login via access code at /en/login or /id/login. Use access code from seed data.
- **Known limitations:** AI APIs are mocked — assertions tagged [REQUIRES_REAL_API] can only verify structure, not semantic correctness.

## Validation Concurrency

- **Machine:** 18 GB RAM, 12 CPUs (macOS ARM)
- **Available headroom:** ~10.4 GB (70% = ~7.3 GB budget)
- **Next.js dev server:** ~300 MB
- **Per agent-browser instance:** ~400 MB
- **Max concurrent validators:** 5
- **Rationale:** Greenfield Next.js app is lightweight. 5 instances = ~2.3 GB (dev server + 5 browsers), well within 7.3 GB budget. Capped at 5 per system limit.

## Testing Setup Requirements

- Run `bun install` to install dependencies
- Run `bunx prisma db push` to set up SQLite database
- Run `bunx prisma db seed` to seed test data (access codes, sample discoveries)
- Start dev server: `PORT=3100 bun run dev`
- Health check: `curl -sf http://localhost:3100`

## Seed Data Requirements

Tests need:
- At least 2 valid access codes
- At least 1 expired access code
- At least 1 child with a completed discovery (for quest testing)
- At least 1 child with a completed quest (for gallery testing)
- At least 3 gallery entries from different countries (for map/clustering testing)
