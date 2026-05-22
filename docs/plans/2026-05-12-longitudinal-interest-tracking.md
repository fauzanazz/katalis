# Data Loop & Longitudinal Interest Tracking Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use parallel-plan-execution to implement this plan task-by-task.
>
> **AGENTS rule:** Before modifying any Next.js code, read relevant guide in `node_modules/next/dist/docs/`. This repo uses Next.js version with breaking changes. Do not rely on pretrained Next.js assumptions.

**Goal:** Build Data Loop & Longitudinal Interest Tracking for Katalis: collect implicit + explicit interest signals from discovery, quests, missions, reflections, parent feedback, compute longitudinal child interest profiles, and expose parent-facing insight UI.

**Architecture:** Add fixed v1 taxonomy, normalized interest signal ledger, aggregate child profile table, mission assessment table, explicit rating inputs, audit table from start. Services write append-only `InterestSignal` rows, recompute `ChildInterestProfile`, and provide parent UI insight summaries. Keep v1 simple: deterministic scoring first, AI summaries optional via existing AI libs.

**Tech Stack:** Next.js App Router, TypeScript, Prisma, existing AI libs in `src/lib/ai/*`, bun/pnpm, existing app/api route handlers, parent UI routes/components.

---

## Decisions Locked

- Include backend and parent UI.
- Fixed v1 taxonomy allowed.
- Add explicit rating.
- Include audit table from start.
- Use TDD-oriented task breakdown.
- Prefer `bun` or `pnpm`; do not use `npm`.

---

## Proposed v1 Taxonomy

```ts
export const INTEREST_TAXONOMY_V1 = [
  "nature",
  "animals",
  "space",
  "building",
  "machines",
  "art",
  "music",
  "storytelling",
  "movement",
  "sports",
  "cooking",
  "science",
  "math_patterns",
  "social_helping",
  "leadership",
  "collecting",
  "pretend_play",
  "technology",
  "reading",
  "water_play",
] as const;
```

Signal sources:

```ts
export const INTEREST_SIGNAL_SOURCES = [
  "discovery_analysis",
  "quest_started",
  "quest_completed",
  "mission_completed",
  "reflection",
  "gallery_entry",
  "explicit_child_rating",
  "explicit_parent_rating",
  "parent_follow_feedback",
  "ai_parent_report",
] as const;
```

Signal dimensions:

```ts
export const INTEREST_SIGNAL_DIMENSIONS = [
  "engagement",
  "persistence",
  "joy",
  "curiosity",
  "independence",
  "repeat_request",
  "skill_growth",
  "frustration",
] as const;
```

---

## Data Model Target

Add to `prisma/schema.prisma`:

```prisma
model InterestSignal {
  id                String   @id @default(cuid())
  childId           String
  child             Child    @relation(fields: [childId], references: [id], onDelete: Cascade)

  taxonomyVersion   String   @default("v1")
  interestKey       String
  source            String
  dimension         String
  strength          Float
  confidence        Float    @default(1)

  discoveryId       String?
  questId           String?
  missionId         String?
  reflectionEntryId String?
  galleryEntryId    String?

  metadataJson      Json?
  observedAt        DateTime @default(now())
  createdAt         DateTime @default(now())

  @@index([childId, interestKey])
  @@index([childId, observedAt])
  @@index([source])
}

model ChildInterestProfile {
  id              String   @id @default(cuid())
  childId         String
  child           Child    @relation(fields: [childId], references: [id], onDelete: Cascade)

  taxonomyVersion String   @default("v1")
  interestKey     String
  score           Float    @default(0)
  confidence      Float    @default(0)
  signalCount     Int      @default(0)
  lastSignalAt    DateTime?
  trend           String   @default("stable")
  summary         String?

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@unique([childId, taxonomyVersion, interestKey])
  @@index([childId, score])
}

model MissionInterestAssessment {
  id                 String   @id @default(cuid())
  childId            String
  child              Child    @relation(fields: [childId], references: [id], onDelete: Cascade)

  missionId          String
  mission            Mission  @relation(fields: [missionId], references: [id], onDelete: Cascade)

  taxonomyVersion    String   @default("v1")
  interestKey        String
  explicitRating     Int?
  parentRating       Int?
  childRating        Int?
  observedEngagement Int?
  notes              String?

  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt

  @@unique([childId, missionId, interestKey])
  @@index([childId, missionId])
}

model InterestAuditEvent {
  id           String   @id @default(cuid())
  childId      String?
  actorUserId  String?
  eventType    String
  entityType   String
  entityId     String?
  beforeJson   Json?
  afterJson    Json?
  metadataJson Json?
  createdAt    DateTime @default(now())

  @@index([childId])
  @@index([eventType])
  @@index([createdAt])
}
```

Add relation arrays to `Child` and `Mission`, adjusted to actual schema:

```prisma
model Child {
  interestSignals             InterestSignal[]
  interestProfiles            ChildInterestProfile[]
  missionInterestAssessments  MissionInterestAssessment[]
}

model Mission {
  interestAssessments MissionInterestAssessment[]
}
```

---

## Session Milestones

### Session 0: Repo Discovery + Next.js Docs Gate

Exit criteria: exact package commands, Prisma client import, route paths, parent UI paths, and relevant Next.js docs known.

Tasks:

1. Read `package.json`, lockfile, test config, `prisma/schema.prisma`.
2. Identify commands for test/typecheck/lint/build/Prisma.
3. Read relevant docs under `node_modules/next/dist/docs/` before App Router route/page/component edits.
4. Inspect:
   - `src/app/api/discovery/save/route.ts`
   - discovery routes
   - quest routes
   - parent/follow routes
5. Locate Prisma client import.
6. Locate parent UI pages/components.

Suggested commands:

```bash
bun test
bun run typecheck
bun run lint
bun run build
bunx prisma validate
bunx prisma generate
```

Use `pnpm` equivalents if project has no Bun scripts.

---

### Session 1: Data Layer

Exit criteria: Prisma validates, migration generated, taxonomy tests pass, repository tests pass.

#### Task 1: Add Prisma models

Files:

- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/*_add_longitudinal_interest_tracking/`

Steps:

1. Run `bunx prisma validate` or `pnpm prisma validate`.
2. Add `InterestSignal`, `ChildInterestProfile`, `MissionInterestAssessment`, `InterestAuditEvent`.
3. Add relations to `Child` and `Mission`.
4. Run validation.
5. Generate migration:

```bash
bunx prisma migrate dev --name add_longitudinal_interest_tracking
```

or:

```bash
pnpm prisma migrate dev --name add_longitudinal_interest_tracking
```

6. Inspect migration SQL.

#### Task 2: Add taxonomy constants

Files:

- Create: `src/lib/interests/taxonomy.ts`
- Create: `src/lib/interests/taxonomy.test.ts`

Tests:

- unique interest keys
- known keys accepted
- unknown keys rejected
- source keys unique
- dimension keys unique

Implementation API:

```ts
export const INTEREST_TAXONOMY_VERSION = "v1" as const;
export type InterestKey = (typeof INTEREST_TAXONOMY_V1)[number];
export type InterestSignalSource = (typeof INTEREST_SIGNAL_SOURCES)[number];
export type InterestSignalDimension = (typeof INTEREST_SIGNAL_DIMENSIONS)[number];
export function isInterestKey(value: string): value is InterestKey;
export function assertInterestKey(value: string): asserts value is InterestKey;
```

#### Task 3: Add repository functions

Files:

- Create: `src/lib/interests/repository.ts`
- Create: `src/lib/interests/repository.test.ts`

API:

```ts
export type CreateInterestSignalInput = {
  childId: string;
  interestKey: InterestKey;
  source: InterestSignalSource;
  dimension: InterestSignalDimension;
  strength: number;
  confidence?: number;
  discoveryId?: string;
  questId?: string;
  missionId?: string;
  reflectionEntryId?: string;
  galleryEntryId?: string;
  metadataJson?: unknown;
  observedAt?: Date;
};

export async function createInterestSignal(input: CreateInterestSignalInput) {}
export async function listInterestSignalsForChild(childId: string) {}
export async function upsertChildInterestProfile(input: UpsertChildInterestProfileInput) {}
export async function createInterestAuditEvent(input: CreateInterestAuditEventInput) {}
export async function upsertMissionInterestAssessment(input: UpsertMissionInterestAssessmentInput) {}
```

Rules:

- validate taxonomy key
- clamp `strength` to `[-1, 1]`
- clamp `confidence` to `[0, 1]`
- repository persists only; no scoring logic

#### Task 4: Add DB smoke test if harness exists

Files:

- Create: `src/lib/interests/db-smoke.test.ts` if integration DB test harness exists

Test:

- create child fixture
- create signal
- create profile
- create mission assessment if mission fixture possible
- query by `childId`

Skip if no DB harness. Do not invent heavyweight harness.

---

### Session 2: Scoring Services

Exit criteria: score computation, profile rebuild, ingestion, explicit rating tests pass.

#### Task 5: Add scoring service

Files:

- Create: `src/lib/interests/scoring.ts`
- Create: `src/lib/interests/scoring.test.ts`

Formula v1:

```text
contribution = strength * confidence * dimensionWeight * recencyWeight
```

Recency:

```text
<= 7 days: 1
<= 30 days: 0.75
<= 90 days: 0.5
older: 0.25
```

Dimension weights:

```text
engagement: 1.0
persistence: 1.15
joy: 1.1
curiosity: 1.05
independence: 1.0
repeat_request: 1.2
skill_growth: 1.0
frustration: -0.8
```

Trend:

```text
rising if last30 - prev30 > 0.15
falling if last30 - prev30 < -0.15
stable otherwise
```

#### Task 6: Add profile rebuild service

Files:

- Create: `src/lib/interests/profile-service.ts`
- Create: `src/lib/interests/profile-service.test.ts`

API:

```ts
export async function rebuildChildInterestProfiles(childId: string, now = new Date()) {}
```

Behavior:

1. Load signals for child.
2. Group by `interestKey`.
3. Compute profile.
4. Upsert profile.
5. Write `InterestAuditEvent` with `eventType: "child_interest_profile_rebuilt"`.

#### Task 7: Add ingestion service

Files:

- Create: `src/lib/interests/ingest-service.ts`
- Create: `src/lib/interests/ingest-service.test.ts`

API:

```ts
export async function ingestInterestSignals(input: {
  childId: string;
  source: InterestSignalSource;
  signals: Array<{
    interestKey: InterestKey;
    dimension: InterestSignalDimension;
    strength: number;
    confidence?: number;
    metadataJson?: unknown;
  }>;
  discoveryId?: string;
  questId?: string;
  missionId?: string;
  reflectionEntryId?: string;
  galleryEntryId?: string;
  observedAt?: Date;
}) {}
```

Behavior:

1. No-op for empty signals.
2. Validate keys.
3. Persist each signal.
4. Write audit event `interest_signals_ingested`.
5. Rebuild child profiles.
6. Return `{ created: number }`.

#### Task 8: Add explicit rating service

Files:

- Create: `src/lib/interests/explicit-rating-service.ts`
- Create: `src/lib/interests/explicit-rating-service.test.ts`

API:

```ts
export async function submitMissionInterestRating(input: {
  childId: string;
  missionId: string;
  interestKey: InterestKey;
  rating: number;
  rater: "child" | "parent";
  notes?: string;
}) {}
```

Rating map:

```text
1 -> -0.8
2 -> -0.3
3 -> 0.1
4 -> 0.6
5 -> 1.0
```

Behavior:

1. Validate integer rating `1..5`.
2. Upsert `MissionInterestAssessment`.
3. Ingest signal:
   - child: source `explicit_child_rating`, dimension `joy`
   - parent: source `explicit_parent_rating`, dimension `engagement`
4. Write audit event `mission_interest_rating_submitted`.

---

### Session 3: API Integration

Exit criteria: route tests pass, existing API behavior preserved.

Before tasks: read relevant Next.js route handler docs in `node_modules/next/dist/docs/`.

#### Task 9: Integrate discovery save/analyze

Files:

- Modify: `src/app/api/discovery/save/route.ts`
- Create: `src/lib/interests/discovery-mapper.ts`
- Create: `src/lib/interests/discovery-mapper.test.ts`

Mapper API:

```ts
export function mapDiscoveryAnalysisToInterestSignals(analysis: unknown): Array<{
  interestKey: InterestKey;
  dimension: InterestSignalDimension;
  strength: number;
  confidence: number;
  metadataJson?: unknown;
}> {}
```

Mapping examples:

- science keywords -> `science`
- animal keywords -> `animals`
- drawing/art/color -> `art`
- building/block/lego -> `building`
- story/character -> `storytelling`
- space/planet/star -> `space`
- movement/dance/run -> `movement`
- music/song/rhythm -> `music`
- technology/robot/computer -> `technology`
- nature/plant/outdoor -> `nature`

Route behavior:

1. Save discovery as before.
2. Map `aiAnalysis`/`detectedTalents`.
3. Call `ingestInterestSignals` with `source: "discovery_analysis"`.
4. Interest ingestion failure should not break discovery save in v1; log and continue.

#### Task 10: Integrate quest and mission lifecycle signals

Files:

- Modify quest route files found in Session 0.
- Modify mission completion route files found in Session 0.
- Create: `src/lib/interests/quest-mapper.ts`
- Create: `src/lib/interests/quest-mapper.test.ts`

Mapper APIs:

```ts
export function mapQuestToInterestSignals(quest: unknown): MappedInterestSignal[] {}
export function mapMissionCompletionToInterestSignals(input: {
  quest?: unknown;
  mission?: unknown;
  reflection?: unknown;
}): MappedInterestSignal[] {}
```

Rules:

- quest started: dimension `curiosity`, strength `0.25`, confidence `0.5`
- quest completed: dimension `persistence`, strength `0.7`, confidence `0.75`
- mission completed: dimension `engagement`, strength `0.6`, confidence `0.7`

#### Task 11: Add explicit rating API

Files:

- Create: `src/app/api/interests/rating/route.ts`
- Create route test matching repo convention

Endpoint:

```http
POST /api/interests/rating
```

Request:

```json
{
  "childId": "child_123",
  "missionId": "mission_123",
  "interestKey": "science",
  "rating": 5,
  "rater": "parent",
  "notes": "Asked to do it again tomorrow"
}
```

Response:

```json
{ "ok": true }
```

Validation:

- missing `childId` -> 400
- missing `missionId` -> 400
- invalid `interestKey` -> 400
- rating outside `1..5` -> 400
- invalid `rater` -> 400
- unauthorized parent access -> existing repo convention, likely 401/403

#### Task 12: Add parent interest insight API

Files:

- Create: `src/app/api/parent/children/[childId]/interests/route.ts`
- Create: `src/lib/interests/parent-insight-service.ts`
- Create: `src/lib/interests/parent-insight-service.test.ts`

Service API:

```ts
export async function getParentInterestInsights(childId: string): Promise<{
  topInterests: Array<{
    interestKey: InterestKey;
    score: number;
    confidence: number;
    trend: "rising" | "falling" | "stable";
    signalCount: number;
    lastSignalAt: string | null;
    summary: string | null;
  }>;
  recentSignals: Array<{
    interestKey: InterestKey;
    source: string;
    dimension: string;
    strength: number;
    observedAt: string;
  }>;
  suggestedNextQuestions: string[];
}> {}
```

Endpoint:

```http
GET /api/parent/children/:childId/interests
```

---

### Session 4: Parent UI

Exit criteria: parent can view insight cards, audit table, and submit rating.

Before tasks: read relevant Next.js docs for server/client components and data fetching.

#### Task 13: Add parent insight component

Files:

- Create likely: `src/components/parent/InterestInsights.tsx`
- Create: `src/components/parent/InterestInsights.test.tsx`

Component renders:

- title: `Interest patterns over time`
- subtitle: `Signals from discoveries, quests, missions, reflections, and ratings.`
- empty state
- top interest cards
- trend label
- confidence label
- signal count
- last observed
- recent signal audit table
- suggested questions

#### Task 14: Wire parent page

Files:

- Modify exact parent page from Session 0, likely:
  - `src/app/parent/page.tsx`
  - `src/app/parent/[childId]/page.tsx`
  - `src/app/parent/children/[childId]/page.tsx`
  - `src/app/(parent)/**/page.tsx`

Preferred if server component:

- call `getParentInterestInsights(childId)` directly
- pass to `InterestInsights`

If client component pattern used:

- create `src/components/parent/InterestInsightsClient.tsx`
- fetch `/api/parent/children/[childId]/interests`

#### Task 15: Add explicit mission rating UI

Files:

- Create likely: `src/components/parent/MissionInterestRating.tsx`
- Create: `src/components/parent/MissionInterestRating.test.tsx`
- Modify mission/quest parent UI file found in Session 0

Props:

```ts
type MissionInterestRatingProps = {
  childId: string;
  missionId: string;
  interestKey: string;
  initialRating?: number | null;
};
```

Behavior:

- client component
- render 1-5 rating control
- POST to `/api/interests/rating`
- `rater: "parent"`
- disable while saving
- show saved/error state
- accessible labels `Rate interest 1` etc.

#### Task 16: Add audit table visibility

Files:

- Modify: `src/components/parent/InterestInsights.tsx`
- Modify: `src/lib/interests/parent-insight-service.ts`

Columns:

- Date
- Interest
- Source
- Signal
- Strength

No raw IDs exposed in UI.

---

### Session 5: Verification + Docs

Exit criteria: tests/typecheck/lint/build/Prisma pass; docs written; reviewer complete.

#### Task 17: Full verification

Commands, adjusted to package scripts:

```bash
bun test
bun run typecheck
bun run lint
bun run build
bunx prisma validate
bunx prisma generate
```

or pnpm equivalents.

#### Task 18: Add seed/fixture support only if existing seed exists

Search existing seed file. If none, skip.

Possible files:

- `prisma/seed.ts`
- `scripts/seed.ts`
- `src/**/seed*.ts`

Add sample child with:

- interest signals
- profiles
- mission assessment
- audit event

#### Task 19: Add feature docs

Files:

- Create/modify: `docs/features/longitudinal-interest-tracking.md` or existing docs feature directory

Content:

- taxonomy v1
- signal sources
- rating scale
- scoring formula
- audit table
- API endpoints
- parent UI behavior
- known v1 limitations

---

## Parallel Groups

### Group A: Discovery-only research

Can run together before implementation:

- package/test command discovery
- API route discovery
- Prisma client import discovery
- parent UI discovery

Do not run route/UI edits until Next.js docs gate complete.

### Group B: Data-independent unit code

After Prisma schema/migration generated:

- taxonomy constants
- scoring service
- discovery mapper
- quest mapper

### Group C: Service layer

After repository exists:

- profile rebuild service
- ingestion service
- explicit rating service

Implementation sequence:

```text
profile-service -> ingest-service -> explicit-rating-service
```

### Group D: UI and API after service contracts stable

After services exist:

- rating API
- parent insight component
- rating component
- audit table UI

Parent page wiring depends on insight service and component.

---

## Done Criteria

Feature complete when:

1. `prisma/schema.prisma` includes:
   - `InterestSignal`
   - `ChildInterestProfile`
   - `MissionInterestAssessment`
   - `InterestAuditEvent`
   - required relations on `Child` and `Mission`
2. Fixed v1 taxonomy exists in `src/lib/interests/taxonomy.ts`.
3. Backend services exist and are tested:
   - `src/lib/interests/repository.ts`
   - `src/lib/interests/scoring.ts`
   - `src/lib/interests/profile-service.ts`
   - `src/lib/interests/ingest-service.ts`
   - `src/lib/interests/explicit-rating-service.ts`
   - `src/lib/interests/parent-insight-service.ts`
4. Integrations exist:
   - discovery save/analyze produces interest signals
   - quest/mission completion produces interest signals
   - explicit parent rating writes assessment + signal
   - profile rebuild runs after ingestion
5. APIs exist and are tested:
   - `POST /api/interests/rating`
   - `GET /api/parent/children/[childId]/interests`
6. Parent UI exists:
   - insight cards
   - trend/confidence display
   - explicit rating control
   - audit table visible from start
7. Audit from start:
   - `InterestAuditEvent` records signal ingestion, profile rebuild, explicit rating
   - parent UI shows recent interest signal audit table
8. Verification commands pass:
   - test
   - typecheck
   - lint
   - build
   - Prisma validate
9. Next.js AGENTS rule satisfied:
   - implementation notes confirm relevant docs in `node_modules/next/dist/docs/` were read before modifying App Router route/page/component code.

---

## Recommended Execution

Use multi-session mode.

Start with Session 0, then execute one milestone at a time. Each milestone should end green before next milestone starts.
