# Design: ZPD / Scaffolding

**Date:** 2026-05-22
**Status:** Design approved (Phase 2 of vibe pipeline)
**Spec:** `.planning/spec-zpd.md`
**Sister spec / coordination:** `.planning/spec.md` (Age Stratification — separate agent owns `Child.dateOfBirth` + `getAgeGroup`)
**Selected approach:** **C — Hybrid scalar-internal + band-exposed**

---

## 1. Context

Validation doc §3.1 (Dynamic Leveling) and §3.2 (7-day phase scaffold) are coupled: the scaffold needs a calibration anchor, and the anchor only matters if downstream artifacts (missions, mentor adjustments, parent UI) consume it.

Existing relevant state:
- `Mission` already has `day: Int (1-7)`. Each Quest has 7 Missions. **The "7-day scaffold" is the Mission row sequence — no new table needed.**
- Quest generation flow: `src/lib/ai/client.ts → generateQuest → providers → persist in src/app/api/quest/generate/route.ts:120`.
- Mission completion entry: `src/app/api/quest/[id]/mission/[missionId]/route.ts:185` (transactional, completes mission, unlocks next).
- Reflection capture: `ReflectionEntry` keyed by `(childId, questId, missionDay)`.
- Mentor adjustment: `AdjustmentEvent`; logic in `src/lib/ai/mentor/chat.ts` + `frustration.ts`.

## 2. Data model

### 2.1 New tables / fields

```prisma
// New table — current ZPD score per child
model ChildZpdState {
  id        String   @id @default(cuid())
  childId   String   @unique
  child     Child    @relation(fields: [childId], references: [id], onDelete: Cascade)
  score     Float    @default(0.30)  // [0.0, 1.0] internal scalar; baseline = developing band
  band      String   @default("developing")  // derived on write; cached for query speed
  updatedAt DateTime @updatedAt
  createdAt DateTime @default(now())
}

// New table — history snapshots (for parent chart + trend math)
model ChildZpdSnapshot {
  id        String   @id @default(cuid())
  childId   String
  child     Child    @relation(fields: [childId], references: [id], onDelete: Cascade)
  score     Float
  band      String
  missionId String?  // nullable — first baseline snapshot has no mission
  reason    String   // "baseline" | "mission_completed" | "reflection_submitted" | "frustration_sustained" | "mission_abandoned"
  createdAt DateTime @default(now())

  @@index([childId, createdAt])
}

// Extend existing Mission — additive nullable columns
model Mission {
  // ... existing fields
  phase          String?  // "high" | "medium" | "low" — scaffold phase for this day
  intensityHint  Float?   // anchor score the AI used to calibrate this day's task
  intent         String?  // short text intent for the day (e.g., "stretch", "stabilize", "consolidate")
}
```

### 2.2 Child model edits
**None.** DOB ownership lives with sister spec; this work consumes `getAgeGroup(child.dateOfBirth)` if helper exists, else neutral default.

### 2.3 Band derivation (pure function)

```ts
// src/lib/zpd/band.ts
export const ZPD_BANDS = ["emerging", "developing", "proficient", "extending"] as const;
export type ZpdBand = (typeof ZPD_BANDS)[number];

export function scoreToBand(score: number): ZpdBand {
  if (score < 0.25) return "emerging";
  if (score < 0.50) return "developing";
  if (score < 0.75) return "proficient";
  return "extending";
}

export function bandRank(band: ZpdBand): number {
  return ZPD_BANDS.indexOf(band);
}
```

## 3. Update rule

```ts
// src/lib/zpd/update.ts
const BASE_STEP = 0.04;

const OUTCOME_MULT = {
  completion_strong_reflection: 1.0,   // completion + reflection sentiment positive
  completion: 0.6,                     // completion, no/neutral reflection
  completion_with_frustration: 0.2,    // completed but had sustained frustration
  abandoned: -0.5,                     // mission abandoned
  frustration_sustained: -0.3,         // standalone sustained frustration episode
};

// Recency weight: more recent missions matter more for trajectory
function recencyWeight(daysSinceLastUpdate: number): number {
  if (daysSinceLastUpdate <= 1) return 1.2;   // back-to-back -> momentum
  if (daysSinceLastUpdate <= 7) return 1.0;   // within a week -> normal
  if (daysSinceLastUpdate <= 30) return 0.8;  // within a month -> mild
  return 0.6;                                 // stale -> dampened
}

export function computeNextScore(
  current: number,
  outcome: keyof typeof OUTCOME_MULT,
  daysSinceLastUpdate: number,
): number {
  const delta = BASE_STEP * OUTCOME_MULT[outcome] * recencyWeight(daysSinceLastUpdate);
  return clamp01(current + delta);
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}
```

## 4. Phase scaffold

### 4.1 Phase distribution

Hard-coded per validation doc: day 1–2 = `high`, day 3–5 = `medium`, day 6–7 = `low`.

```ts
// src/lib/zpd/phases.ts
export function dayToPhase(day: number): "high" | "medium" | "low" {
  if (day <= 2) return "high";
  if (day <= 5) return "medium";
  return "low";
}

export function phaseIntensityAnchor(score: number, phase: "high" | "medium" | "low"): number {
  const offset = phase === "high" ? +0.15 : phase === "medium" ? +0.05 : -0.10;
  return clamp01(score + offset);
}
```

### 4.2 Generator integration

`generateQuest` input gains `zpdScore`. Each provider prompt-template gets a `phases:` block:

```
Calibration anchors per day (intensityHint is a scalar 0-1 representing challenge level):
- Day 1 (high): intensityHint=0.45 — stretch beyond comfort
- Day 2 (high): intensityHint=0.45 — same
- Day 3-5 (medium): intensityHint=0.35 — stabilize
- Day 6-7 (low): intensityHint=0.20 — consolidate / showcase

Each day's task must match its phase intent.
```

`QuestGenerationOutputSchema.missions[]` gains `phase`, `intensityHint`, `intent` fields (all optional in zod but always populated by AI). Persistence pipes them into the new Mission columns.

## 5. Update triggers (inline only — no async)

| Trigger | Outcome | Where | What writes |
|---------|---------|-------|-------------|
| Mission completion (no reflection yet) | `completion` | `src/app/api/quest/[id]/mission/[missionId]/route.ts` after status=completed | `ChildZpdState` + snapshot reason=`mission_completed` |
| Reflection submitted for completed mission | recompute as `completion_strong_reflection` if positive sentiment, else stays `completion` | reflection submit endpoint | upsert state + snapshot reason=`reflection_submitted` |
| Sustained frustration in mentor chat (level ≥ medium for 2+ consecutive msgs) | `frustration_sustained` | `src/lib/ai/mentor/chat.ts` after frustration scorer | state + snapshot reason=`frustration_sustained`; rate-limit 1 per mission |
| Mission abandoned (quest status → abandoned) | `abandoned` | quest abandon path (TBD if route exists; if not, deferred) | state + snapshot reason=`mission_abandoned` |

**Idempotency:** snapshot table is append-only. Repeated triggers for the same `(missionId, reason)` are deduped via existence check.

## 6. Consumers

### 6.1 Mission generator (already covered §4.2)
Read `ChildZpdState.score` → compute per-day anchors → pass into prompt.

### 6.2 Quest Buddy mentor chat
`src/lib/ai/mentor/chat.ts:getMentorSystemPrompt(child)`: read child's current band, inject "stay at or above band X" instruction. When generating Small Adjustment, the adjustment selector compares the proposed simplification's `intensityHint` against the floor:

```ts
const floorBand = scoreToBand(currentZpdScore);
if (bandRank(scoreToBand(adjustment.intensityHint)) < bandRank(floorBand)) {
  // reject adjustment; ask AI to regenerate within band
}
```

### 6.3 Frustration handler
Already triggers adjustment offer. Add: on `sustained` frustration detection (existing scorer), call `recordZpdEvent({ childId, outcome: "frustration_sustained", missionId })`. Rate-limited via "1 frustration_sustained snapshot per mission".

### 6.4 Parent insight report
New section in `src/app/[locale]/parent/page.tsx`:
- Card titled "Capability trajectory" per linked child.
- Sparkline: x = createdAt, y = score, last 30 entries.
- Current band label below.
- Data source: `ChildZpdSnapshot` ordered by createdAt desc, limit 30.

## 7. File map

```
src/lib/zpd/
  band.ts              # scoreToBand, bandRank, ZPD_BANDS
  phases.ts            # dayToPhase, phaseIntensityAnchor
  update.ts            # computeNextScore, OUTCOME_MULT
  service.ts           # getZpdState, recordZpdEvent (orchestrator)
  repository.ts        # prisma CRUD for ChildZpdState + ChildZpdSnapshot
  index.ts             # public exports
  __tests__/
    band.test.ts
    phases.test.ts
    update.test.ts
    service.test.ts

src/lib/ai/quest-schemas.ts                 # extend MissionSchema with phase/intensityHint/intent
src/lib/ai/providers/*.ts                   # prompt template gains zpd block
src/app/api/quest/generate/route.ts         # read ZPD score, pass to generateQuest, persist phase fields
src/app/api/quest/[id]/mission/[missionId]/route.ts  # call recordZpdEvent on completion
src/app/api/reflection/.../route.ts         # call recordZpdEvent on submit (locate exact route in build)
src/lib/ai/mentor/chat.ts                   # band-floor enforcement on adjustment
src/lib/ai/mentor/frustration.ts            # emit zpd event on sustained frustration

src/app/[locale]/parent/page.tsx            # add Capability trajectory section
src/components/parent/CapabilityTrajectoryCard.tsx  # new — sparkline + band label

prisma/schema.prisma                        # additive: ChildZpdState, ChildZpdSnapshot, Mission.{phase,intensityHint,intent}
prisma/migrations/<ts>_add_zpd/             # new migration
```

## 8. Locales

New user-facing copy (parent card title, band labels, intent strings):
- `messages/en.json`, `messages/id.json`, `messages/zh.json` each get a `parent.zpd.*` namespace.

Bands are stored as English strings in DB; locale strings translate them at render.

## 9. Backward compatibility

- Existing Missions without `phase` → consumers fall back to "no phase metadata" path (Mission renders as today).
- Existing Children without `ChildZpdState` row → first mission completion lazily creates the row with default baseline 0.30.
- Existing parent dashboard → new section is additive; if no snapshots exist, render placeholder "We're learning about your child's progress…".

## 10. Acceptance test outline (for Phase 4 verify)

See spec §9. Key suites:
- `src/lib/zpd/__tests__/*.test.ts` — pure functions.
- `src/app/api/quest/__tests__/zpd-on-completion.test.ts` — integration: completing a mission writes a snapshot.
- `src/lib/ai/mentor/__tests__/floor.test.ts` — adjustment never returns below band.
- `src/components/parent/__tests__/CapabilityTrajectoryCard.test.tsx` — renders N points.
- Manual: 3 locales × 1 sample quest → eyeball day-1 vs day-7 difficulty differential.

## 11. Risks + mitigations

| Risk | Mitigation |
|------|------------|
| AI providers ignore the new prompt anchors | Validate output: if `phase`/`intensityHint` absent, recompute from `day` server-side and log a metric for "AI dropped phase". |
| Score drifts to extremes (everyone hits 1.0 or 0.0) | `BASE_STEP=0.04` keeps movement small. Recency weight ≤ 1.2. Add monitoring later if needed (not in this pass). |
| DOB agent ships after this work; baseline ignores age | Baseline = 0.30 regardless. When DOB ships, follow-up issue: add age-derived baseline. Out of scope here. |
| Snapshot table grows unboundedly | Per-row cost tiny (~80 bytes). 100 quests × 7 = 700 rows / active child. Acceptable for years. Revisit at 10x scale. |
| Mentor band-floor blocks all simplification | Fallback: if no valid in-band simplification exists, mentor offers encouragement copy instead of a task simplification. Logged for review. |

## 12. Resolved decisions

| Decision | Resolution |
|----------|-----------|
| Storage shape | Extend `Mission` (`phase`, `intensityHint`, `intent`); new `ChildZpdState` + `ChildZpdSnapshot` tables |
| Snapshot trigger | On every mission completion, reflection, sustained frustration episode (rate-limited), abandonment |
| Update rule | Weighted delta with recency: `BASE_STEP * OUTCOME_MULT * recencyWeight` |
| Floor strictness | Strict band-floor: `scoreToBand(adjustment) >= scoreToBand(currentScore)` |
| Default baseline | 0.30 (developing band lower edge) |
| Penalty trigger | Sustained frustration only (≥ medium for 2+ msgs), once per mission |
| Retention | Forever — small footprint, simple |
| Parent surface | New section in `/parent` dashboard; sparkline + band label |
