# Katalis — Architecture Document

> **Katalis** (Discover – Act – Connect) is a children's talent discovery and development platform. Children upload creative artifacts for AI analysis, receive personalized 7-day quest plans, and showcase completed work on a global gallery map.

---

## 1. System Overview

Katalis is organized around three pillars:

| Pillar | Name | Purpose |
|--------|------|---------|
| **Discovery** | Interest Discovery Agent ("Talent Scout") | Children upload artifacts (drawings, audio, photos) or complete story-prompting exercises. AI multimodal analysis detects deep interests and talents beyond surface categorization. |
| **Action** | Dream Catalyst Agent ("7-Day Quest") | AI generates a personalized 7-day mission plan based on detected talents, the child's dream, and local context — turning children from observers into doers. |
| **Connection** | Global Squad Gallery ("Shared Map") | An interactive world map showcasing children's completed works, clustered by talent category and geography. Fosters global solidarity without risky free-form social interaction. |

All three pillars share a common authentication layer (access codes), a bilingual UI (Indonesian + English), and a privacy-first design that collects no personal data from children.

---

## 2. Tech Stack

| Layer | Technology | Role |
|-------|-----------|------|
| Framework | **Next.js 15 (App Router)** | Full-stack React framework — server components, API routes, middleware |
| Runtime / Package Manager | **Bun** | JavaScript runtime and package manager |
| Database | **Prisma + SQLite** | ORM with file-based database (`dev.db`) — no external DB server |
| Styling | **Tailwind CSS + shadcn/ui** | Utility-first CSS with accessible, composable UI components |
| Internationalization | **next-intl** | URL-based locale routing, server/client translation, ICU message format |
| AI — Vision & Analysis | **OpenAI SDK (GPT-4o)** | Multimodal artifact analysis (image + text) |
| AI — Generation | **Anthropic SDK (Claude)** | Quest and mission generation |
| File Storage | **Cloudflare R2** (S3-compatible) | Image and audio uploads via presigned URLs |
| Maps | **react-map-gl + maplibre-gl** | WebGL-based interactive map with MapTiler vector tiles |
| Testing | **Vitest + React Testing Library** | Unit, component, and API route tests |

---

## 3. Project Structure

```
katalis/
├── prisma/
│   ├── schema.prisma              # Database schema
│   └── migrations/                # Prisma migration history
├── messages/
│   ├── en.json                    # English translations
│   └── id.json                    # Indonesian translations
├── public/                        # Static assets (icons, images)
├── src/
│   ├── app/
│   │   ├── [locale]/              # i18n dynamic segment (en, id)
│   │   │   ├── layout.tsx         # Root locale layout (NextIntlClientProvider)
│   │   │   ├── page.tsx           # Landing page
│   │   │   ├── (auth)/            # Auth-gated route group
│   │   │   │   ├── discover/      # Discovery flow pages
│   │   │   │   ├── quest/         # Quest flow pages
│   │   │   │   └── gallery/       # Gallery browsing pages
│   │   │   └── login/             # Access code login page
│   │   └── api/                   # API route handlers
│   │       ├── auth/              # Login, session endpoints
│   │       ├── upload/            # Presigned URL generation
│   │       ├── discover/          # AI analysis endpoints
│   │       ├── quest/             # Quest generation & progress
│   │       └── gallery/           # Gallery data & entries
│   ├── components/                # Shared React components
│   │   ├── ui/                    # shadcn/ui primitives
│   │   ├── layout/                # Header, footer, navigation
│   │   └── map/                   # Map-related components
│   ├── lib/                       # Shared utilities & clients
│   │   ├── db.ts                  # Prisma client singleton
│   │   ├── auth.ts                # Session management helpers
│   │   ├── ai/                    # AI integration layer
│   │   │   ├── openai.ts          # GPT-4o client
│   │   │   ├── claude.ts           # Claude client
│   │   │   └── mock/              # Deterministic mock responses
│   │   └── storage/               # File storage layer
│   │       ├── r2.ts              # Cloudflare R2 client
│   │       └── mock.ts            # Local filesystem mock
│   ├── i18n/                      # next-intl configuration
│   │   ├── routing.ts             # defineRouting (locales, default)
│   │   ├── request.ts             # getRequestConfig (message loading)
│   │   └── navigation.ts          # Locale-aware Link, redirect, etc.
│   └── middleware.ts              # Combines i18n routing + auth protection
├── .env                           # Environment variables
├── next.config.ts                 # Next.js + next-intl plugin config
├── tailwind.config.ts             # Tailwind configuration
└── package.json
```

**Key conventions:**
- `src/app/[locale]/` — all user-facing pages live under the locale segment.
- `src/app/[locale]/(auth)/` — route group that requires a valid session; middleware redirects unauthenticated users to login.
- `src/app/api/` — API routes live outside the locale segment (no i18n needed for JSON endpoints).
- `src/lib/` — server-side utilities; never imported by client components directly.
- `src/components/` — shared React components; may be server or client components.

---

## 4. Data Model

The following entities form the core data model. All IDs are cuid strings. Timestamps are UTC.

```
┌─────────────┐       ┌─────────────┐
│ AccessCode   │ 1───* │ Child        │
│              │       │              │
│ code (unique)│       │ displayName  │
│ active       │       │ country      │
│ expiresAt    │       │ avatarUrl    │
└─────────────┘       └──────┬───────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
              ▼              ▼              ▼
       ┌─────────────┐ ┌──────────┐  ┌──────────────┐
       │ Discovery    │ │ Quest    │  │ GalleryEntry  │
       │              │ │          │  │               │
       │ type (enum)  │ │ dream    │  │ imageUrl      │
       │   artifact   │ │ context  │  │ talentCategory│
       │   story      │ │ status   │  │ country       │
       │ fileUrl      │ │          │  │ coordinates   │
       │ aiAnalysis   │ └────┬─────┘  │ clusterGroup  │
       │ detectedTalents│    │        └───────────────┘
       └─────────────┘      │
                             │
                        ┌────┴─────┐
                        │ Mission   │
                        │           │
                        │ day (1-7) │
                        │ title     │
                        │ description│
                        │ instructions│
                        │ materials │
                        │ tips      │
                        │ status    │
                        │ proofPhotoUrl│
                        └───────────┘
```

**Entity summary:**

| Entity | Purpose | Key Fields |
|--------|---------|------------|
| **AccessCode** | Anonymous authentication token | `code` (unique), `active`, `expiresAt` |
| **Child** | Anonymous child profile linked to an access code | `displayName`, `country`, `avatarUrl` |
| **Discovery** | Result of an artifact upload or story-prompting session | `type` (artifact / story), `fileUrl`, `aiAnalysis` (JSON), `detectedTalents` (JSON array) |
| **Quest** | A 7-day mission plan generated from a discovery | `dream`, `localContext`, `status` (active / completed / abandoned) |
| **Mission** | A single day within a quest | `day` (1–7), `title`, `description`, `instructions`, `materials`, `tips`, `status`, `proofPhotoUrl` |
| **GalleryEntry** | A published work on the global map | `imageUrl`, `talentCategory`, `country`, `coordinates` (lat/lng), `clusterGroup` |

**Relationships:**
- AccessCode → Child: one-to-many (one code can create multiple child profiles)
- Child → Discovery: one-to-many
- Child → Quest: one-to-many
- Quest → Mission: one-to-many (exactly 7 per quest)
- Quest → GalleryEntry: one-to-one (best work from completed quest)
- Child → GalleryEntry: one-to-many

---

## 5. Authentication Flow

Katalis uses **access code authentication** — no email, password, or personal data collected.

```
┌─────────┐    1. Enter code     ┌───────────┐    2. Validate code    ┌──────────┐
│  Child   │ ──────────────────→ │ POST      │ ──────────────────── → │ Database │
│ (Browser)│                     │ /api/auth │                        │          │
│          │ ← ──────────────── │ /login    │ ← ──────────────────── │          │
│          │    4. Set session   │           │    3. Code valid +     └──────────┘
│          │       cookie        └───────────┘       not expired
└─────────┘
     │
     │  5. Subsequent requests carry session cookie
     ▼
┌───────────────┐    6. Check session    ┌──────────────┐
│ middleware.ts  │ ─────────────────── → │ Session Store │
│               │                        │ (cookie-based)│
│ Valid? → pass  │ ← ──────────────────  └──────────────┘
│ Invalid? → /login
└───────────────┘
```

**Key design decisions:**
- Session stored as a signed HTTP-only cookie (not a JWT in localStorage)
- Middleware (`src/middleware.ts`) protects all routes under `(auth)/`
- Public routes (landing page, login) are accessible without a session
- Access codes can have expiration dates and can be deactivated
- No personal data is ever collected or stored for children

---

## 6. AI Integration

AI functionality is accessed through a **mock layer architecture** that allows development and testing without real API keys.

```
┌──────────────────┐
│  API Route /      │
│  Server Action    │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐     USE_MOCK_AI=true      ┌──────────────────┐
│  src/lib/ai/     │ ─────────────────────── → │  src/lib/ai/mock/ │
│  openai.ts       │                           │  openai.ts        │
│  claude.ts       │     USE_MOCK_AI=false     │  claude.ts        │
│                  │ ─────────────────────── → │                   │
│ (facade layer)   │                           │ (deterministic    │
│                  │     Real SDKs             │  responses)       │
└──────────────────┘                           └──────────────────┘
```

| Module | AI Provider | Purpose |
|--------|-----------|---------|
| `src/lib/ai/openai.ts` | GPT-4o (multimodal) | Artifact analysis — accepts images and text, returns detected talents with reasoning |
| `src/lib/ai/claude.ts` | Claude | Quest generation — accepts talent profile + dream + context, returns 7-day mission plan |
| `src/lib/ai/mock/` | None (deterministic) | Returns hardcoded but realistic responses for each AI endpoint |

**Toggle mechanism:**
- Environment variable `USE_MOCK_AI=true` routes all AI calls to the mock layer.
- Each facade function checks this variable and dispatches accordingly.
- Mock responses are deterministic — same input always produces same output — enabling reliable testing.
- When real API keys are added later, set `USE_MOCK_AI=false` to use live AI services.

---

## 7. File Storage

Katalis uses **Cloudflare R2** (S3-compatible) for image and audio file uploads, with a local filesystem fallback for development.

```
┌─────────┐    1. Request presigned URL    ┌──────────────┐
│ Browser  │ ────────────────────────────→  │ POST /api/   │
│          │                                │ upload       │
│          │ ← ──────────────────────────── │              │
│          │    2. { signedUrl, key }       └──────────────┘
│          │
│          │    3. PUT file directly ─────→  ┌─────────┐
│          │                                 │ R2 /    │
│          │    4. 200 OK  ← ────────────── │ Local FS│
└─────────┘                                  └─────────┘
```

| Module | Purpose |
|--------|---------|
| `src/lib/storage/r2.ts` | S3-compatible client using `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner` |
| `src/lib/storage/mock.ts` | Stores files on local filesystem; serves via a local API route; used when R2 credentials are not configured |

**Key behaviors:**
- Browser uploads files directly to R2 via presigned PUT URLs (files never pass through the Next.js server).
- EXIF metadata is stripped from images before upload (client-side).
- File type and size validation happens both client-side and server-side.
- Object keys use UUIDs to prevent collisions and hide original filenames (privacy).

---

## 8. Internationalization

Katalis supports two locales — **Indonesian (`id`)** and **English (`en`)** — using `next-intl` with URL-based routing.

```
URL structure:
  /id/discover   →  Indonesian
  /en/discover   →  English
  /discover      →  Redirects to default locale (id)
```

| Component | File | Role |
|-----------|------|------|
| Routing config | `src/i18n/routing.ts` | Defines supported locales (`en`, `id`) and default (`id`) |
| Request config | `src/i18n/request.ts` | Loads the correct `messages/{locale}.json` per request |
| Navigation | `src/i18n/navigation.ts` | Exports locale-aware `Link`, `redirect`, `useRouter`, `usePathname` |
| Middleware | `src/middleware.ts` | Detects locale from URL, redirects if missing, sets locale for downstream |
| Translation files | `messages/en.json`, `messages/id.json` | Namespaced flat JSON with all UI strings |

**Server Components** use `getTranslations()` (async, zero client bundle cost).  
**Client Components** use `useTranslations()` (requires `NextIntlClientProvider` in the locale layout).

---

## 9. Map Integration

The Global Gallery uses an interactive world map to display children's completed works.

| Package | Role |
|---------|------|
| `react-map-gl` | React wrapper for map rendering |
| `maplibre-gl` | Open-source WebGL map engine (backend for react-map-gl) |
| MapTiler (tiles) | Vector tile provider (free tier: 100k loads/month) |

**Architecture:**
- Map component is a **client component** (`'use client'`), loaded via `next/dynamic` with `ssr: false` (WebGL requires browser APIs).
- Gallery data is fetched in a **server component** and passed as props to the map.
- **Built-in source-level clustering** groups nearby pins on the GPU — no additional clustering library needed.
- `clusterProperties` on the GeoJSON source enable **category-aware clusters** (e.g., show talent type breakdown within each cluster).
- Data-driven styling colors pins by talent category.

**Scaling strategy:**
- Under 10k entries: all data loaded client-side, clustered by MapLibre.
- Beyond 10k entries: viewport-based API loading (fetch only visible bounds).

---

## 10. Key Invariants

These rules must **never** be violated across the entire codebase:

| # | Invariant | Enforcement |
|---|-----------|-------------|
| 1 | **No personal data stored for children** | No email, real name, phone, or address fields in the schema. Access codes are anonymous. Code review policy. |
| 2 | **All user text sanitized before rendering** | React's default JSX escaping + explicit sanitization for any `dangerouslySetInnerHTML` usage. No raw HTML injection from AI responses. |
| 3 | **EXIF metadata stripped from all uploaded images** | Client-side stripping before upload. Server-side validation rejects images with EXIF GPS data. |
| 4 | **Sequential quest progression** | Day N mission cannot be marked complete before Day N-1. API enforces ordering; UI disables future days. |
| 5 | **Access code required for all non-public routes** | Middleware checks session cookie on every request to `(auth)/` routes. No API route under `/api/` (except `/api/auth/login`) responds without a valid session. |
| 6 | **File uploads validated** | Server-side type checking (allowlist: JPEG, PNG, WebP, MP3, WAV, WebM) and size limits (images: 10 MB, audio: 50 MB). |
| 7 | **AI prompts sanitized** | User-provided text is sanitized before inclusion in AI prompts to prevent prompt injection. |
| 8 | **R2 credentials never exposed to browser** | Presigned URL generation happens server-side only. S3 client lives in `src/lib/` which is never imported by client components. |
