# Codebase Patterns & Conventions

Discovered during gallery milestone scrutiny validation (round 1).

## safeParseJSON Utility Duplication

**Pattern**: Prisma SQLite stores JSON columns as strings. A `safeParseJSON(value)` helper that parses JSON strings with a fallback is duplicated in 6 files:
- `src/app/api/gallery/entries/route.ts`
- `src/app/api/gallery/entries/[id]/route.ts`
- `src/app/api/gallery/entries/geojson/route.ts`
- `src/app/api/quest/[id]/route.ts`
- `src/app/api/quest/[id]/complete/route.ts`
- `src/app/[locale]/gallery/[id]/page.tsx`

**Recommendation**: Extract to `src/lib/json-utils.ts` to reduce duplication.

## API Field Renaming Convention

**Pattern**: API responses sometimes rename Prisma schema fields for clarity:
- `detectedTalents` (Prisma) → `talents` (API response) in `/api/discovery/history`

**Risk**: If consumers use the Prisma field name instead of the API response field name, bugs result (this happened in the cross-area-data-flow fix).

**Recommendation**: Document field renames in comments near API response construction.

## Gallery Route Placement

**Pattern**: Gallery routes (`/[locale]/gallery/`) are placed outside any `(auth)` route group intentionally. Gallery browsing is publicly accessible (read-only). Auth gating is handled by `src/proxy.ts` which adds `/gallery` to `publicPagePaths` and `publicPathPrefixes`.

**Note**: `architecture.md` still references an `(auth)` route group that doesn't exist in the actual implementation. All auth gating is done via the proxy middleware.

## Middleware Naming

**Pattern**: Next.js 16 renamed `middleware.ts` to `proxy.ts`. The actual middleware file is at `src/proxy.ts`, not `src/middleware.ts` as some docs reference.
