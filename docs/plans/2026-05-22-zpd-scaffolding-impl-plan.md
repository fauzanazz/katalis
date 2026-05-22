# Impl Plan: ZPD / Scaffolding

**Date:** 2026-05-22
**Design:** `docs/plans/2026-05-22-zpd-scaffolding-design.md`
**Spec:** `.planning/spec-zpd.md`
**Approach:** C (hybrid scalar + band)
**Estimated sessions:** 4 (build) + 1 (verify/ship). Each session ends with green tests + failing tests defining the next session's work (TDD-as-contract).

---

## Session 1 — Schema + pure functions

**Goal:** Land the data layer + pure helpers. Repository CRUD compiles. Pure-function tests green.

**Tasks (TDD order):**
1. Write failing tests:
   - `src/lib/zpd/__tests__/band.test.ts` — `scoreToBand` boundary tests (0, 0.24, 0.25, 0.49, 0.50, 0.74, 0.75, 1.0); `bandRank` ordering.
   - `src/lib/zpd/__tests__/phases.test.ts` — `dayToPhase(1..7)` table; `phaseIntensityAnchor` clamp + offset math.
   - `src/lib/zpd/__tests__/update.test.ts` — `computeNextScore` cases: clean completion, completion+strong-reflection, completion+frustration, abandoned, frustration_sustained; recency weight tiers; clamp at 0 + 1; idempotency on same input.
2. Implement:
   - `src/lib/zpd/band.ts`
   - `src/lib/zpd/phases.ts`
   - `src/lib/zpd/update.ts`
3. Migration: `prisma/schema.prisma` additive changes (`ChildZpdState`, `ChildZpdSnapshot`, `Mission.{phase,intensityHint,intent}`). Generate migration + run on local dev DB. **Do not run prod migration.**
4. Repository: `src/lib/zpd/repository.ts` with `getState(childId)`, `upsertState(childId, score, band)`, `appendSnapshot({...})`, `listSnapshots(childId, limit)`. Type-only test against a mocked Prisma client OR an integration smoke test using a test DB.
5. Service skeleton: `src/lib/zpd/service.ts` exports `getZpdScore(childId)` (returns default `0.30` if no row) + `recordZpdEvent({ childId, outcome, missionId? })` (writes state + snapshot inline, transactional).
6. Index: `src/lib/zpd/index.ts` public exports.

**End-of-session test gate:**
- `bun test src/lib/zpd/__tests__/` green.
- Prisma client compiles.
- One failing test seeded for Session 2: `src/lib/ai/__tests__/quest-schemas-zpd.test.ts` — asserts `QuestGenerationInputSchema` accepts `zpdScore` and `MissionSchema` accepts `phase/intensityHint/intent`. Will go red until Session 2 lands them.

---

## Session 2 — Quest generation integration

**Goal:** Generator emits phase metadata; persistence stores it. Generated missions visibly differ across phases (manual eyeball check).

**Tasks (TDD order):**
1. Make Session 1's red test (`quest-schemas-zpd.test.ts`) the entry point.
2. Extend zod schemas in `src/lib/ai/quest-schemas.ts`:
   - `QuestGenerationInputSchema`: add `zpdScore: z.number().min(0).max(1).optional()`.
   - `MissionSchema`: add `phase: z.enum(["high","medium","low"]).optional()`, `intensityHint: z.number().min(0).max(1).optional()`, `intent: z.string().optional()`.
3. For each provider in `src/lib/ai/providers/*.ts` (anthropic, google, openai, openrouter, grok, nvidia, vertex-ai):
   - Inject ZPD anchor block into the prompt template (use shared helper to avoid 7× duplication).
   - Parse phase/intensityHint/intent from model response; fall back to server-side derivation (`dayToPhase` + `phaseIntensityAnchor`) if model omits.
4. Mock provider in `src/lib/ai/mock/quest-generation.ts`: emit phase metadata deterministically for tests.
5. Modify `src/app/api/quest/generate/route.ts:120`:
   - Before `generateQuest`, fetch `zpdScore = await getZpdScore(childId)`.
   - Pass `{ ...input, zpdScore }` to provider.
   - In the `missions.create` payload, persist `phase`, `intensityHint`, `intent`.
6. Tests:
   - `src/app/api/quest/__tests__/generate-zpd.test.ts` — integration: generate stub provider with predictable output → quest row written has phase fields populated.
   - Add snapshot test: mock provider output → expected day-by-day phase distribution `[high,high,medium,medium,medium,low,low]`.

**End-of-session test gate:**
- All Session 1 tests still green.
- New generate-zpd test green.
- Failing test seeded for Session 3: `src/app/api/quest/__tests__/zpd-on-completion.test.ts` — asserts completing a mission creates a `ChildZpdSnapshot` row with `reason="mission_completed"`.

---

## Session 3 — Trigger wiring (completion / reflection / frustration)

**Goal:** ZPD state evolves automatically. Snapshots appear after each event.

**Tasks (TDD order):**
1. Make Session 2's red test (`zpd-on-completion.test.ts`) the entry point.
2. Modify mission completion route (`src/app/api/quest/[id]/mission/[missionId]/route.ts`):
   - After successful completion transaction (line ~233), call `recordZpdEvent({ childId, outcome: "completion", missionId })`.
   - Wrap in try/catch so a failure doesn't 500 the mission completion (log + continue).
3. Locate reflection submit endpoint (likely `src/app/api/reflection/` — confirm in build). Add hook:
   - On submit, if mission is `completed` and reflection sentiment is positive, call `recordZpdEvent({ childId, outcome: "completion_strong_reflection", missionId })`.
   - "Positive sentiment" detection: lightweight — reuse existing `aiSummary` field if it carries a score, else a simple keyword heuristic for v1 (TODO marker for later refinement).
4. Frustration trigger in `src/lib/ai/mentor/frustration.ts`:
   - When scorer returns `medium`/`high` for 2+ consecutive messages, emit `recordZpdEvent({ childId, outcome: "frustration_sustained", missionId })`.
   - Rate-limit: query last snapshot for this mission; skip if `reason="frustration_sustained"` already exists for `missionId`.
5. Tests:
   - `zpd-on-completion.test.ts` (already failing).
   - `src/app/api/reflection/__tests__/zpd-on-reflection.test.ts` — submit reflection → snapshot row with `reason="reflection_submitted"`.
   - `src/lib/ai/mentor/__tests__/frustration-zpd.test.ts` — simulate sustained frustration → snapshot + rate-limit.

**End-of-session test gate:**
- All prior tests green.
- New triggers tested.
- Failing test seeded for Session 4: `src/lib/ai/mentor/__tests__/floor.test.ts` — asserts adjustment never violates band floor + `src/components/parent/__tests__/CapabilityTrajectoryCard.test.tsx` — asserts component renders N data points.

---

## Session 4 — Mentor floor + parent UI + i18n

**Goal:** Mentor adjustments respect ZPD floor. Parent dashboard renders capability trajectory.

**Tasks (TDD order):**
1. Make Session 3's red tests the entry points.
2. Mentor floor in `src/lib/ai/mentor/chat.ts`:
   - Where adjustment is generated, validate: `bandRank(scoreToBand(adjustment.intensityHint)) >= bandRank(scoreToBand(currentZpdScore))`.
   - If violated, regenerate (max 1 retry); if still violated, return encouragement copy in place of task simplification.
   - Inject current band into the mentor system prompt so model self-constrains.
3. Component `src/components/parent/CapabilityTrajectoryCard.tsx`:
   - Props: `{ childId, snapshots: ChildZpdSnapshot[] }`.
   - Render: sparkline (use lightweight library already in repo, or inline SVG); current band label below; "We're learning…" placeholder if `snapshots.length === 0`.
4. Wire into `src/app/[locale]/parent/page.tsx`:
   - Per linked child, fetch `listSnapshots(childId, 30)` server-side.
   - Pass to `<CapabilityTrajectoryCard />`.
5. i18n in `messages/{en,id,zh}.json`:
   - `parent.zpd.title`
   - `parent.zpd.bands.{emerging,developing,proficient,extending}`
   - `parent.zpd.placeholder`
6. Tests:
   - `floor.test.ts` (already failing): 4 cases per band.
   - `CapabilityTrajectoryCard.test.tsx` (already failing): N snapshots → N points + label + empty-state placeholder.
   - Component snapshot test for visual stability.

**End-of-session test gate:**
- All prior tests green.
- New mentor + UI tests green.
- No new failing tests — work scope closed.

---

## Session 5 — Verify + ship

**Goal:** Pass `finishing-a-development-branch` gates.

**Tasks:**
1. Manual review: generate 1 quest in each locale (en/id/zh) with stub provider → eyeball day-1 vs day-7 task copy → confirm visible challenge differential.
2. Run full test suite: `bun test`.
3. Lint + typecheck: `bun lint`, `bun typecheck` (or project equivalent).
4. Invoke `review` skill on the branch diff.
5. Security scan: confirm no OWASP issues in new routes / DB writes (mainly: ensure `recordZpdEvent` uses parameterized Prisma queries — it will by default).
6. Invoke `finishing-a-development-branch`.
7. Commit per the standard project commit style. PR with summary + test plan.

---

## Cross-session contracts (TDD handoffs)

| Session ends | Failing test left | Defines next session |
|--------------|-------------------|---------------------|
| 1 | `quest-schemas-zpd.test.ts` | Session 2: schema fields |
| 2 | `zpd-on-completion.test.ts` | Session 3: triggers |
| 3 | `floor.test.ts` + `CapabilityTrajectoryCard.test.tsx` | Session 4: mentor + UI |
| 4 | — | Session 5: verify only |

## Risks tracked here

- **Provider drift**: each of 7 providers needs prompt update. Mitigation: shared helper + integration test that swaps providers via mock to verify output schema.
- **i18n drift**: 3 locales. Add missing-key check in tests or rely on type-safe message keys if `next-intl` strict mode enabled — confirm in Session 4.
- **Reflection sentiment scoring**: v1 uses heuristic. TODO marker for v2 refinement once reliability harness exists.

## Out-of-plan but adjacent (defer)

- Age-derived baseline (depends on DOB agent shipping).
- KidsArtBench 9-dim ZPD vector.
- Voice prosodic frustration → ZPD penalty.
- ZPD-aware cluster nudges in gallery / squad.
