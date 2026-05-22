# Design: Age Stratification

**Date:** 2026-05-22
**Status:** Draft for approval
**Spec:** `.planning/spec.md`
**Related research:** validation doc on developmental age bands (3-6 / 7-9 / 10-12)

---

## 1. Goal

Adapt Discover, Quest Buddy mentor, and Mission generator to a child's developmental band
derived from a new `Child.dateOfBirth` field. Bands: `3-6`, `7-9`, `10-12`, plus `unknown`
(fallback for legacy null DoB rows).

## 2. Architecture

**Direction: Hybrid — shared primitives + domain-owned policy.**

```
src/lib/age/
  index.ts                # getAgeGroup, AgeGroup type, AGE_BANDS const
  __tests__/index.test.ts

src/lib/ai/mentor/
  age-config.ts           # prompts + frustration thresholds per band
  age-config.test.ts
  chat.ts                 # consumes age-config (already exists)
  frustration.ts          # consumes age-config thresholds (already exists)

src/lib/ai/quest/
  age-caps.ts             # per-band mission duration caps + prompt fragments
  age-caps.test.ts
  (existing generation lives in src/app/api/quest/generate/route.ts)

src/lib/discover/
  age-modality.ts         # allowed input modalities per band
  age-modality.test.ts

src/components/discover/  # InputSelector reads age-modality
src/components/parent/    # AddChildDialog adds DoB field; new BackfillDoBPrompt component
```

## 3. Domain model changes

### 3.1 Prisma schema

```prisma
model Child {
  id            String   @id @default(cuid())
  // ... existing fields
  dateOfBirth   DateTime?      // NEW. Nullable for backfill compatibility.
  // ... existing relations
}

model Mission {
  id                 String   @id @default(cuid())
  // ... existing fields
  estimatedMinutes   Int?     // NEW. Nullable for legacy missions.
  // ... existing relations
}
```

Migration: `prisma migrate dev --name add-age-stratification`. Two columns, both nullable.
Safe on existing data.

### 3.2 Type contracts

```ts
// src/lib/age/index.ts
export type AgeGroup = "3-6" | "7-9" | "10-12" | "unknown";

export const AGE_BANDS = {
  "3-6":   { min: 3,  max: 6  },
  "7-9":   { min: 7,  max: 9  },
  "10-12": { min: 10, max: 12 },
} as const;

export type AgeResult = { band: AgeGroup; years: number | null };

export function getAgeGroup(dob: Date | null | undefined, now: Date = new Date()): AgeResult;
// Convenience: `const { band } = getAgeGroup(child.dateOfBirth);`
```

Edge cases:
- `null/undefined` → `"unknown"`
- Future DoB → `"unknown"` (invalid input; do not throw)
- Age < 3 → `"unknown"` (too young; trigger validation upstream)
- Age > 12 → `"unknown"` (out of supported range; trigger validation upstream)

## 4. Per-domain policy

### 4.1 Mentor

```ts
// src/lib/ai/mentor/age-config.ts
import type { AgeGroup } from "@/lib/age";

export const MENTOR_PROMPTS: Record<AgeGroup, string> = {
  "3-6":   "You are an encouraging mentor for children aged 3–6. Use very short sentences,
            simple words, lots of warmth. Ask one tiny question at a time...",
  "7-9":   "You are an encouraging mentor for children aged 7–9. Use Socratic guidance,
            never say 'wrong' or 'fail', frame setbacks as 'Small Adjustments'...",
  "10-12": "You are an encouraging mentor for children aged 10–12. Engage with their reasoning,
            invite hypotheses, encourage iteration...",
  "unknown": /* same as 7-9 (baseline) */,
};

export const FRUSTRATION_THRESHOLDS: Record<AgeGroup, { low: number; medium: number; high: number }> = {
  "3-6":   { low: 1, medium: 2, high: 3 },     // very low tolerance; offer help sooner
  "7-9":   { low: 2, medium: 4, high: 6 },     // current baseline
  "10-12": { low: 3, medium: 6, high: 9 },     // higher tolerance; let them push through
  "unknown": /* same as 7-9 */,
};
```

`chat.ts` and `frustration.ts` accept an optional `ageGroup` parameter; resolve from `Child.dateOfBirth` at the API route boundary.

### 4.2 Quest / Mission

```ts
// src/lib/ai/quest/age-caps.ts
export const MISSION_DURATION_CAPS: Record<AgeGroup, number> = {
  "3-6":   10,
  "7-9":   20,
  "10-12": 40,
  "unknown": 20,
};

export function buildAgeConstraintPromptFragment(band: AgeGroup): string;
export function clampOrRejectMissions(
  missions: { estimatedMinutes?: number; ... }[],
  band: AgeGroup
): { ok: true; missions: ... } | { ok: false; reason: string };
```

`/api/quest/generate/route.ts` calls `buildAgeConstraintPromptFragment(band)` and appends to
the existing Claude system prompt; after parsing the response, calls `clampOrRejectMissions`;
on rejection, retry once with stricter instructions, then surface a 502 to the client.

`MissionSchema` (Zod, `src/lib/ai/quest-schemas.ts`) gains `estimatedMinutes: z.number().int().min(1).max(60)`.

### 4.3 Discover modality

```ts
// src/lib/discover/age-modality.ts
export type Modality = "photo" | "voice" | "text";

export const ALLOWED_MODALITIES: Record<AgeGroup, Modality[]> = {
  "3-6":   ["photo"],
  "7-9":   ["photo", "voice"],
  "10-12": ["photo", "voice", "text"],
  "unknown": ["photo", "voice"],   // 7-9 baseline
};

export function isModalityAllowed(band: AgeGroup, modality: Modality): boolean;
```

**Enforcement points:**
- UI: `src/app/[locale]/discover/page.tsx` reads child's band, hides/disables disallowed input tabs.
- Server: every Discover upload API (`/api/discover/*`) reads child band server-side from session, rejects with `400 modality_not_allowed_for_age` if violated.

## 5. UI changes

### 5.1 AddChildDialog
- Add required Date picker `dateOfBirth`. Min: today − 13y. Max: today − 3y. Validation via Zod
  before submit. Localized labels (en/id/zh).

### 5.2 Parent dashboard backfill prompt
- New component `src/components/parent/BackfillDoBPrompt.tsx`.
- Renders as **inline banner** above the child cards on `/parent` when any of the parent's
  linked children has `dateOfBirth === null`.
- Lists each affected child by name with an inline DoB picker + submit button.
- Non-blocking; dismissable per session but reappears on next page visit until all filled.
- Uses sonner toast on success/error.

### 5.3 Discover page
- `InputSelector` (existing or new) reads child band → conditionally renders photo / voice /
  text tabs. Disabled tabs show tooltip: "Available when child is older."

### 5.4 Quest detail
- Mission card displays `estimatedMinutes` next to title.

## 6. API surface

| Route | Change |
|-------|--------|
| `POST /api/parent/children` | Accept + require `dateOfBirth`. |
| `PATCH /api/parent/children/:id` | Accept partial update including `dateOfBirth` (backfill). |
| `POST /api/discover/*` | Server-side band check before accepting payload. Reject with 400 + error code. |
| `POST /api/quest/generate` | Read child band; inject cap fragment; validate + clamp/reject output. |
| `POST /api/mentor/*` (chat / frustration scoring) | Resolve band; thread through to prompt and threshold lookup. |

## 7. i18n keys

Add to `messages/{en,id,zh}.json`:
```
parent.addChild.dobLabel
parent.addChild.dobHelp
parent.backfillDob.title
parent.backfillDob.description
parent.backfillDob.submit
discover.modality.disabledTooltip
errors.modalityNotAllowedForAge
```

## 8. Testing strategy

| Layer | Test |
|-------|------|
| Unit | `getAgeGroup` table-driven: every band boundary, null, future, <3, >12 |
| Unit | `MENTOR_PROMPTS` / `FRUSTRATION_THRESHOLDS` exhaustive on `AgeGroup` |
| Unit | `MISSION_DURATION_CAPS` + `clampOrRejectMissions` golden cases |
| Unit | `ALLOWED_MODALITIES` + `isModalityAllowed` exhaustive |
| Unit | Existing `chat.test`, `frustration.test` updated to assert per-band branch |
| Integration | `/api/discover/*` rejects disallowed modality with 400 |
| Integration | `/api/quest/generate` invokes age-constrained prompt + validates output |
| Integration | `/api/parent/children` requires DoB on create; accepts patch on backfill |
| E2E (Playwright if available; otherwise integration) | Backfill prompt appears for null-DoB child, disappears after submit |
| Manual | Visit `/parent`, `/discover`, `/quest` as each band; confirm visible differences |

## 9. Rollout

1. Schema migration + helper module + tests (no behavior change visible to users).
2. Add DoB to AddChildDialog (new children get DoB).
3. Add Parent backfill prompt (existing children prompted on next visit).
4. Wire Mentor age-config (immediate visible AI behavior shift for children with DoB; null falls back to current behavior).
5. Wire Discover modality gate (UI + server).
6. Wire Mission duration caps (schema field + generation prompt + validation).

Each step is independently testable; deploy to staging in order.

## 10. Risks & mitigations

| Risk | Mitigation |
|------|-----------|
| Parent enters wrong DoB (typo, joke) | Min/max picker constraints (3–13y). Allow parent edit anytime. |
| 13+ child uses app | `getAgeGroup` returns `unknown`; spec out of scope for >12 but UI shows banner suggesting account migration in a follow-up. *(Open: confirm we want this in scope or defer to follow-up.)* |
| Generation fails repeatedly due to strict cap | Retry once with stricter prompt; on second failure, surface 502 with retry option. Log for tuning. |
| Mentor session crashes mid-conversation when DoB becomes available | Resolve band at session-start only; in-flight session keeps initial band. |
| Migration runs partially on prod | Both new columns are nullable; partial state is non-fatal. |

## 11. Out of scope (re-stated from spec)

- Formal age verification.
- Voice prosodic frustration sensing.
- Auto re-classification mid-mission on birthday.
- KidsArtBench 9-dim + Cohen's Kappa reliability.

## 12. Decisions log

| Date | Decision | Resolution |
|------|----------|-----------|
| 2026-05-22 | `getAgeGroup` return shape | `{ band: AgeGroup, years: number \| null }` — future-proof |
| 2026-05-22 | Backfill prompt UX | Inline banner on `/parent`, non-blocking, dismissable per session |
| 2026-05-22 | Migration | Nullable `dateOfBirth` + nullable `Mission.estimatedMinutes` |
| 2026-05-22 | Storage | DoB only; band derived on read |
| 2026-05-22 | Modality enforcement | UI disable + server reject (defense in depth) |
| 2026-05-22 | Duration enforcement | Schema field + prompt constraint + post-gen validation w/ one retry |
| 2026-05-22 | Null DoB fallback | Treat as 7-9 band |
| 2026-05-22 | DoB entry points | AddChildDialog (new) + Parent backfill banner (legacy). NOT child register, NOT admin |
