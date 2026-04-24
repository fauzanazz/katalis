# Sprint 6: Squad Gallery 2.0 + Parent Bridge Module

> **For Claude:** REQUIRED SUB-SKILL: Use parallel-plan-execution to implement this plan task-by-task.

**Goal:** Transform the gallery from ephemeral AI clusters into persistent Squad identities with member progression, and build a parent-facing insight layer with reports and actionable home tips.

**Architecture:** Two independent workstreams. Squad Gallery adds persistent `Squad`/`SquadMember` models on top of existing `GalleryEntry` and clustering AI, with multi-tag support via a new `talentTags` JSON field. Parent Bridge adds `ParentChild` linking (User↔Child via access code), `ParentReport` with AI-generated content, and a home tips recommendation engine using child profile + badge/quest data.

**Tech Stack:** Prisma (SQLite), Next.js 16 App Router, Zod, next-intl, Claude AI (reports + tag classification), Tailwind/shadcn

---

## Session 1: Data Layer (5 tasks)

### Task 1: Add Squad + SquadMember Prisma models

**Files:**
- Modify: `prisma/schema.prisma`

Add to `schema.prisma` before the closing:

```prisma
model Squad {
  id              String        @id @default(cuid())
  name            String        // e.g. "Robot Builders from Asia"
  theme           String        // primary talent category
  description     String
  icon            String        @default("🌟") // emoji icon
  countries       String        @default("[]") // JSON array of country strings
  featuredEntryIds String       @default("[]") // JSON array of GalleryEntry IDs
  status          String        @default("active") // "active", "archived"
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt
  members         SquadMember[]

  @@index([theme])
  @@index([status])
}

model SquadMember {
  id        String   @id @default(cuid())
  squadId   String
  childId   String
  joinedAt  DateTime @default(now())

  squad     Squad    @relation(fields: [squadId], references: [id])
  child     Child    @relation(fields: [childId], references: [id])

  @@unique([squadId, childId])
  @@index([childId])
}
```

Also add to `Child` model: `squadMemberships SquadMember[]`

**Step 1:** Edit `prisma/schema.prisma` to add both models and the relation field on Child.

**Step 2:** Run migration:
```bash
bunx prisma migrate dev --name add_squad_system
```

**Step 3:** Verify migration succeeds and `prisma generate` runs.

**Step 4:** Commit.
```bash
git add prisma/ && git commit -m "feat: add Squad and SquadMember models"
```

---

### Task 2: Add ParentChild + ParentReport Prisma models

**Files:**
- Modify: `prisma/schema.prisma`

```prisma
model ParentChild {
  id        String   @id @default(cuid())
  userId    String   // User (parent) ID
  childId   String   // Child ID
  claimedAt DateTime @default(now())

  user      User     @relation(fields: [userId], references: [id])
  child     Child    @relation(fields: [childId], references: [id])

  @@unique([userId, childId])
  @@index([userId])
  @@index([childId])
}

model ParentReport {
  id         String   @id @default(cuid())
  parentId   String   // User (parent) ID
  childId    String
  type       String   // "weekly", "biweekly"
  period     String   // JSON: { start: ISO, end: ISO }
  strengths  String   // JSON array of strength strings
  growthAreas String  // JSON array of growth area strings
  tips       String   // JSON array of tip objects: { title, description, materials }
  summary    String   // AI-generated narrative summary
  badgeHighlights String // JSON: badge names earned in period
  metadata   String?  // JSON: additional context
  createdAt  DateTime @default(now())

  parent     User     @relation(fields: [parentId], references: [id])
  child      Child    @relation(fields: [childId], references: [id])

  @@index([parentId])
  @@index([childId])
  @@index([createdAt])
}
```

Add to `User` model: `children ParentChild[]` and `parentReports ParentReport[]`
Add to `Child` model: `parentLinks ParentChild[]` and `parentReports ParentReport[]`

**Step 1:** Edit `prisma/schema.prisma` to add both models and relation fields.

**Step 2:** Run migration:
```bash
bunx prisma migrate dev --name add_parent_bridge_models
```

**Step 3:** Verify migration succeeds.

**Step 4:** Commit.
```bash
git add prisma/ && git commit -m "feat: add ParentChild and ParentReport models"
```

---

### Task 3: Add `talentTags` field to GalleryEntry

**Files:**
- Modify: `prisma/schema.prisma`

Add `talentTags String?` field to `GalleryEntry` model (JSON array of `{name, confidence}` objects). This enables multi-tag classification beyond the single `talentCategory`.

```prisma
model GalleryEntry {
  // ... existing fields ...
  talentTags     String?  // JSON array: [{ name: "Engineering", confidence: 0.95 }, ...]
  // ... rest unchanged ...
}
```

**Step 1:** Edit `prisma/schema.prisma` to add `talentTags` field.

**Step 2:** Run migration:
```bash
bunx prisma migrate dev --name add_gallery_talent_tags
```

**Step 3:** Commit.
```bash
git add prisma/ && git commit -m "feat: add talentTags field to GalleryEntry"
```

---

### Task 4: Update seed data for new models

**Files:**
- Modify: `prisma/seed.ts`

Add seed data for:
- Squad entries (create squads from existing gallery entries)
- SquadMember links (link child1 and child2 to squads)
- ParentChild link (link test@katalis.ai user to child1)
- One sample ParentReport

Add cleanup for new tables at the top of seed:
```typescript
await prisma.parentReport.deleteMany();
await prisma.parentChild.deleteMany();
await prisma.squadMember.deleteMany();
await prisma.squad.deleteMany();
```

**Step 1:** Edit `prisma/seed.ts` to add seed data for all new models.

**Step 2:** Run:
```bash
bunx prisma db seed
```

**Step 3:** Verify no errors.

**Step 4:** Commit.
```bash
git add prisma/seed.ts && git commit -m "feat: add seed data for squad and parent models"
```

---

### Task 5: Add Zod schemas for Squad and Parent types

**Files:**
- Create: `src/lib/squads/schemas.ts`
- Create: `src/lib/parent/schemas.ts`

**`src/lib/squads/schemas.ts`:**
```typescript
import { z } from "zod";

export const TalentTagSchema = z.object({
  name: z.string().min(1),
  confidence: z.number().min(0).max(1),
});

export type TalentTag = z.infer<typeof TalentTagSchema>;

export const SquadSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  theme: z.string().min(1),
  description: z.string().min(1),
  icon: z.string(),
  countries: z.array(z.string()),
  memberCount: z.number(),
  entryCount: z.number(),
  featuredEntries: z.array(z.object({
    id: z.string(),
    imageUrl: z.string(),
    talentCategory: z.string(),
    country: z.string().nullable(),
  })).optional(),
});

export type Squad = z.infer<typeof SquadSchema>;

export const SquadDetailSchema = SquadSchema.extend({
  entries: z.array(z.object({
    id: z.string(),
    imageUrl: z.string(),
    talentCategory: z.string(),
    country: z.string().nullable(),
    questContext: z.unknown().nullable(),
    createdAt: z.string(),
  })),
});

export type SquadDetail = z.infer<typeof SquadDetailSchema>;

export const MultiTagOutputSchema = z.object({
  tags: z.array(TalentTagSchema),
});

export type MultiTagOutput = z.infer<typeof MultiTagOutputSchema>;
```

**`src/lib/parent/schemas.ts`:**
```typescript
import { z } from "zod";

export const ClaimChildSchema = z.object({
  accessCode: z.string().min(1, "Access code is required"),
});

export type ClaimChildInput = z.infer<typeof ClaimChildSchema>;

export const HomeTipSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  materials: z.array(z.string()),
  category: z.string(), // matches child's talent category
});

export type HomeTip = z.infer<typeof HomeTipSchema>;

export const ReportPeriodSchema = z.object({
  start: z.string(), // ISO date
  end: z.string(),   // ISO date
});

export type ReportPeriod = z.infer<typeof ReportPeriodSchema>;

export const ParentReportSchema = z.object({
  id: z.string(),
  childId: z.string(),
  type: z.enum(["weekly", "biweekly"]),
  period: ReportPeriodSchema,
  strengths: z.array(z.string()),
  growthAreas: z.array(z.string()),
  tips: z.array(HomeTipSchema),
  summary: z.string(),
  badgeHighlights: z.array(z.string()),
  createdAt: z.string(),
  childName: z.string().optional(),
});

export type ParentReport = z.infer<typeof ParentReportSchema>;
```

**Step 1:** Create both schema files.

**Step 2:** Commit.
```bash
git add src/lib/squads/ src/lib/parent/ && git commit -m "feat: add Zod schemas for squad and parent modules"
```

---

## Session 2: Squad Gallery 2.0 Logic (4 tasks)

### Task 6: Multi-tag classifier for gallery entries

**Files:**
- Create: `src/lib/ai/tag-schemas.ts`
- Create: `src/lib/ai/tag-classifier.ts`
- Create: `src/lib/ai/mock/tag-classifier.ts`

**`src/lib/ai/tag-schemas.ts`:**
```typescript
import { z } from "zod";

export const ClassifiedTagSchema = z.object({
  name: z.string().min(1),
  confidence: z.number().min(0).max(1),
  category: z.string().min(1), // broad category: Engineering, Art, etc.
});

export type ClassifiedTag = z.infer<typeof ClassifiedTagSchema>;

export const TagClassificationOutputSchema = z.object({
  tags: z.array(ClassifiedTagSchema).min(1).max(5),
});

export type TagClassificationOutput = z.infer<typeof TagClassificationOutputSchema>;
```

**`src/lib/ai/tag-classifier.ts`:**
Claude-powered multi-tag classifier. Takes quest context + detected talents, returns up to 5 semantic tags with confidence. Routes to mock when `USE_MOCK_AI=true`.

**`src/lib/ai/mock/tag-classifier.ts`:**
Deterministic mock that maps talent categories to multiple sub-tags with fixed confidence scores.

**Step 1:** Create all three files.

**Step 2:** Commit.
```bash
git add src/lib/ai/tag-schemas.ts src/lib/ai/tag-classifier.ts src/lib/ai/mock/tag-classifier.ts && git commit -m "feat: add multi-tag classifier for gallery entries"
```

---

### Task 7: Squad sync service (persist AI clusters as Squads)

**Files:**
- Create: `src/lib/squads/sync.ts`

This service:
1. Calls the existing clustering AI (`clusterGalleryEntries`)
2. For each cluster, creates/updates a `Squad` record
3. Links entries' children as `SquadMember` records
4. Stores featured entry IDs
5. Returns the created/updated squads

**Step 1:** Create `src/lib/squads/sync.ts`.

**Step 2:** Commit.
```bash
git add src/lib/squads/sync.ts && git commit -m "feat: add squad sync service"
```

---

### Task 8: Squad data access helpers

**Files:**
- Create: `src/lib/squads/queries.ts`

Pure query functions:
- `getAllSquads()` — all active squads with member count
- `getSquadById(id)` — squad detail with entries
- `getChildSquads(childId)` — squads a child belongs to
- `getSquadEntries(squadId)` — paginated gallery entries for a squad

**Step 1:** Create `src/lib/squads/queries.ts`.

**Step 2:** Commit.
```bash
git add src/lib/squads/queries.ts && git commit -m "feat: add squad query helpers"
```

---

### Task 9: Squad barrel export

**Files:**
- Create: `src/lib/squads/index.ts`

Re-exports schemas, queries, and sync.

**Step 1:** Create barrel file.

**Step 2:** Commit.
```bash
git add src/lib/squads/index.ts && git commit -m "feat: add squad barrel export"
```

---

## Session 3: Parent Bridge Logic (4 tasks)

### Task 10: Parent-child linking service

**Files:**
- Create: `src/lib/parent/link.ts`

Functions:
- `claimChild(userId, accessCode)` — validates access code, creates `ParentChild` link
- `getParentChildren(userId)` — returns all children linked to a parent
- `getChildParents(childId)` — returns all parents linked to a child (useful for report generation)

**Step 1:** Create `src/lib/parent/link.ts`.

**Step 2:** Commit.
```bash
git add src/lib/parent/link.ts && git commit -m "feat: add parent-child linking service"
```

---

### Task 11: Report generator (AI-powered)

**Files:**
- Create: `src/lib/parent/report-generator.ts`
- Create: `src/lib/ai/parent-report.ts`
- Create: `src/lib/ai/mock/parent-report.ts`

**`src/lib/ai/parent-report.ts`:**
Claude-powered report generator. Takes child's quest data, badge history, mentor interactions, reflections from a period. Returns structured: strengths, growthAreas, tips, summary.

**`src/lib/ai/mock/parent-report.ts`:**
Deterministic mock report based on child's talent category.

**`src/lib/parent/report-generator.ts`:**
Orchestrator that:
1. Queries child's data for the period (quests completed, missions, reflections, badges)
2. Calls AI report generator
3. Persists `ParentReport` record
4. Returns the report

**Step 1:** Create all three files.

**Step 2:** Commit.
```bash
git add src/lib/parent/report-generator.ts src/lib/ai/parent-report.ts src/lib/ai/mock/parent-report.ts && git commit -m "feat: add AI-powered parent report generator"
```

---

### Task 12: Home tips recommendation engine

**Files:**
- Create: `src/lib/parent/home-tips.ts`

Rule-based tips engine that generates actionable at-home mentoring tips based on:
- Child's detected talents
- Badge progress (what they've earned, what's next)
- Quest themes
- Local context (materials available)

Returns tips matched to child profile. No AI needed — uses a curated tip library filtered by talent category.

**Step 1:** Create `src/lib/parent/home-tips.ts` with a `HOME_TIPS_LIBRARY` constant and `getTipsForChild(childProfile)` function.

**Step 2:** Commit.
```bash
git add src/lib/parent/home-tips.ts && git commit -m "feat: add home tips recommendation engine"
```

---

### Task 13: Parent barrel export

**Files:**
- Create: `src/lib/parent/index.ts`

Re-exports schemas, link, report-generator, home-tips.

**Step 1:** Create barrel file.

**Step 2:** Commit.
```bash
git add src/lib/parent/index.ts && git commit -m "feat: add parent module barrel export"
```

---

## Session 4: API Routes (7 tasks)

### Task 14: `GET /api/squads` — list all squads

**Files:**
- Create: `src/app/api/squads/route.ts`

Returns all active squads with member counts. Public endpoint.

**Step 1:** Create route file.

**Step 2:** Commit.
```bash
git add src/app/api/squads/ && git commit -m "feat: add GET /api/squads endpoint"
```

---

### Task 15: `GET /api/squads/[id]` — squad detail with entries

**Files:**
- Create: `src/app/api/squads/[id]/route.ts`

Returns squad with paginated gallery entries. Public endpoint.

**Step 1:** Create route file.

**Step 2:** Commit.
```bash
git add src/app/api/squads/ && git commit -m "feat: add GET /api/squads/[id] endpoint"
```

---

### Task 16: `POST /api/squads/sync` — trigger squad sync

**Files:**
- Create: `src/app/api/squads/sync/route.ts`

Admin-only endpoint. Triggers AI clustering → squad sync. Returns created/updated squads.

**Step 1:** Create route file.

**Step 2:** Commit.
```bash
git add src/app/api/squads/sync/ && git commit -m "feat: add POST /api/squads/sync admin endpoint"
```

---

### Task 17: `GET /api/gallery/entries` — add `tags` filter support

**Files:**
- Modify: `src/app/api/gallery/entries/route.ts`

Add `tag` query parameter that filters by `talentTags` JSON content. Also return `talentTags` in response.

**Step 1:** Modify the GET handler to parse and return `talentTags`, add `tag` filter.

**Step 2:** Commit.
```bash
git add src/app/api/gallery/entries/route.ts && git commit -m "feat: add tag filter to gallery entries API"
```

---

### Task 18: `POST /api/gallery/entries` — store multi-tags on creation

**Files:**
- Modify: `src/app/api/gallery/entries/route.ts`

When creating a gallery entry, call the multi-tag classifier and store results in `talentTags` field.

**Step 1:** Import `classifyTags` and call it during entry creation. Store result in `talentTags`.

**Step 2:** Commit.
```bash
git add src/app/api/gallery/entries/route.ts && git commit -m "feat: store multi-tags on gallery entry creation"
```

---

### Task 19: `POST /api/parent/claim` + `GET /api/parent/children` — parent-child linking

**Files:**
- Create: `src/app/api/parent/claim/route.ts`
- Create: `src/app/api/parent/children/route.ts`

**POST /api/parent/claim:**
Requires user session. Body: `{ accessCode }`. Creates ParentChild link.

**GET /api/parent/children:**
Requires user session. Returns linked children with basic stats.

**Step 1:** Create both route files.

**Step 2:** Commit.
```bash
git add src/app/api/parent/ && git commit -m "feat: add parent claim and children endpoints"
```

---

### Task 20: `POST /api/parent/reports` + `GET /api/parent/reports` — report generation

**Files:**
- Create: `src/app/api/parent/reports/route.ts`

**GET:** Returns existing reports for a child. Query: `?childId=xxx`
**POST:** Generates a new report. Body: `{ childId, type: "weekly" | "biweekly" }`

Both require user session and verify parent-child link.

**Step 1:** Create route file.

**Step 2:** Commit.
```bash
git add src/app/api/parent/reports/ && git commit -m "feat: add parent reports API"
```

---

## Session 5: UI + i18n (5 tasks)

### Task 21: Squad browse page

**Files:**
- Modify: `src/app/[locale]/gallery/page.tsx` — add "Squads" view mode

Add a third view mode "squads" alongside "map" and "clusters". Shows a grid of squad cards with member count, countries, talent theme. Click drills into squad detail.

**Step 1:** Add "squads" view mode to gallery page with `SquadBrowseView` component.

**Step 2:** Commit.
```bash
git add src/app/ && git commit -m "feat: add squads view to gallery page"
```

---

### Task 22: SquadBrowseView + SquadDetail components

**Files:**
- Create: `src/components/gallery/SquadBrowseView.tsx`

Client component that:
- Fetches `/api/squads` on mount
- Renders grid of squad cards (icon, name, theme color, member count, countries)
- Click navigates to `/gallery/squads/[id]` or inline detail

**Step 1:** Create component.

**Step 2:** Commit.
```bash
git add src/components/gallery/SquadBrowseView.tsx && git commit -m "feat: add SquadBrowseView component"
```

---

### Task 23: Parent dashboard page + claim child flow

**Files:**
- Create: `src/app/[locale]/parent/page.tsx`
- Create: `src/components/parent/ChildCard.tsx`
- Create: `src/components/parent/ClaimChildDialog.tsx`

Parent dashboard shows linked children with strength cards. Claim dialog lets parent enter access code.

Protected by user session (any logged-in user can be a parent).

**Step 1:** Create all three files.

**Step 2:** Commit.
```bash
git add src/app/[locale]/parent/ src/components/parent/ && git commit -m "feat: add parent dashboard page"
```

---

### Task 24: Parent report view page

**Files:**
- Create: `src/app/[locale]/parent/reports/[id]/page.tsx`
- Create: `src/components/parent/ReportView.tsx`
- Create: `src/components/parent/StrengthCard.tsx`
- Create: `src/components/parent/GrowthCard.tsx`
- Create: `src/components/parent/HomeTipCard.tsx`

Report page fetches report by ID, renders: summary narrative, strength cards, growth areas, home tips, badge highlights.

**Step 1:** Create all files.

**Step 2:** Commit.
```bash
git add src/app/[locale]/parent/reports/ src/components/parent/ && git commit -m "feat: add parent report view page"
```

---

### Task 25: i18n translations for all new keys

**Files:**
- Modify: `messages/en.json`
- Modify: `messages/id.json`
- Modify: `messages/zh.json`

Add translation keys for:
- `squads.*` — squad browse, detail, member count
- `parent.*` — dashboard, claim, reports, tips, strengths, growth
- `gallery.squads.*` — gallery-embedded squad view

**Step 1:** Add all keys to all three locale files.

**Step 2:** Commit.
```bash
git add messages/ && git commit -m "feat: add i18n for squad and parent modules"
```

---

## Session 6: Integration & Polish (3 tasks)

### Task 26: Integrate tag classifier into gallery entry creation

**Files:**
- Modify: `src/app/api/gallery/entries/route.ts`

Ensure multi-tag classification runs during gallery entry POST and tags are stored + returned.

**Step 1:** Wire up classifier call in POST handler.

**Step 2:** Commit.
```bash
git add src/app/api/gallery/entries/route.ts && git commit -m "feat: integrate tag classifier into gallery creation"
```

---

### Task 27: Build verification

**Step 1:** Run full build:
```bash
bun run build
```

**Step 2:** Fix any type errors or build failures.

**Step 3:** Run seed to verify data:
```bash
bunx prisma db seed
```

**Step 4:** Commit any fixes.

---

### Task 28: Final review commit

**Step 1:** Review all changed files for consistency, i18n coverage, proper error handling.

**Step 2:** Ensure no console.log left in production code.

**Step 3:** Final commit if needed.

---

## Dependency Graph

```
Session 1 (Data Layer)
  Task 1 ─┐
  Task 2 ─┤  (independent, can parallel)
  Task 3 ─┤
  Task 4 ─┤ (depends on Tasks 1-3)
  Task 5 ─┘ (independent)

Session 2 (Squad Logic)
  Task 6 ──┐
  Task 7 ──┤ (depends on Task 1, 6)
  Task 8 ──┤ (depends on Task 1)
  Task 9 ──┘ (depends on Tasks 6-8)

Session 3 (Parent Logic)
  Task 10 ──┐
  Task 11 ──┤ (depends on Task 2)
  Task 12 ──┤ (independent)
  Task 13 ──┘ (depends on Tasks 10-12)

Session 4 (API Routes)
  Tasks 14-16 ── (depend on Session 2)
  Tasks 17-18 ── (depend on Task 3, 6)
  Tasks 19-20 ── (depend on Session 3)

Session 5 (UI + i18n)
  Tasks 21-22 ── (depend on Tasks 14-15)
  Tasks 23-24 ── (depend on Tasks 19-20)
  Task 25 ────── (can start anytime)

Session 6 (Integration)
  Tasks 26-28 ── (depend on all above)
```
