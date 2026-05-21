# Spec: ZPD / Scaffolding

**Status:** Draft for approval
**Date:** 2026-05-22
**Owner:** fauzan
**Pipeline phase:** 1/5 (Spec)
**Sister spec:** `.planning/spec.md` (Age Stratification — separate agent, this work consumes its `getAgeGroup` helper when available)

---

## 1. What we're building

Two coupled mechanisms from the validation doc:

- **§3.1 Dynamic Leveling — Explicit ZPD state.** A per-child capability level that persists across sessions, updates after every mission completion / reflection / frustration episode, and represents the child's current stretch zone (Vygotsky's Zone of Proximal Development).
- **§3.2 7-day mission phase scaffold.** Each generated 7-day mission carries phase metadata: days 1–2 = high challenge (push the upper edge of the stretch zone), days 3–5 = medium (stabilize), days 6–7 = low (consolidate / showcase). The mission generator emits phase-aware daily tasks; consumers respect the phase.

The two are coupled because ZPD level supplies the *anchor* the scaffold phases pivot around: "high challenge" on day 1 means "stretch beyond the child's current ZPD," and "low" on day 7 means "comfortably below the current ZPD ceiling."

## 2. Who this is for

- **Mission generator (AI prompt)** — receives ZPD context + per-day phase metadata in the prompt; daily tasks are calibrated.
- **Quest Buddy mentor chat** — reads current ZPD level to keep Small Adjustments inside the stretch zone (not below current capability).
- **Parent insight report** — surfaces ZPD progression over time as a capability-trajectory chart.
- **Frustration handler** — when frustration triggers adjustment, the adjustment respects the ZPD floor (simplify *within* the stretch zone, never below it).

## 3. Success criteria (observable)

1. **Phase-differentiated tasks.** Day 1–2 tasks in a generated mission are demonstrably harder than day 6–7 tasks in the same mission. Verified by:
   - Snapshot test on generator output: phase metadata present + monotonic difficulty hint.
   - Manual review of 3+ sample missions per locale.
2. **ZPD persists + evolves.** Child's ZPD level changes after a completed mission + reflection. Measurable via:
   - DB state diff before/after `markMissionComplete` in integration test.
   - Recency-weighted update rule: new completions weigh more than old.
3. **Mentor adjustments respect ZPD floor.** Frustration-triggered adjustment outputs never propose a task simpler than the child's current ZPD baseline.
   - Unit test on adjustment logic: given a child with ZPD=B, the adjustment selector never returns difficulty < B.
4. **Parent capability trajectory.** Parent dashboard renders a chart (line or sparkline) of ZPD level over time drawn from ZPD history rows.
   - Integration test: seed 5 ZPD snapshots → render component → assert chart receives 5 data points.

## 4. Out of scope

- Voice prosodic / inactivity / delete-redo behavioral signals (separate future gap from earlier mapping).
- KidsArtBench 9-dimensional grading — ZPD level is a single composite scalar (or coarse band) for this pass.
- `Child.dateOfBirth` ownership, migration, backfill — **owned by sister spec / DOB agent**. This spec only *reads* `getAgeGroup(dob)` when present; uses a neutral default when not.
- Retroactive backfill of ZPD state from historical missions — existing children start at a default baseline; no historical replay.
- Cross-cultural / local-material adaptation (§5.1) — separate work.
- EMA temporal weighting (§6.1) for interest profile is unrelated to ZPD; not in this spec.

## 5. Constraints

- **AI provider abstraction:** Use existing `src/lib/ai/providers/*` router. ZPD prompt context flows through the same pipeline; no new SDK deps.
- **Migrations additive only:** New Prisma tables/columns allowed; no destructive migrations. Prod has live data.
- **Coexist with DOB agent:** Do **not** edit `Child` model fields. Add ZPD as a separate model linked by `childId` FK. Read DOB via the helper the DOB agent ships (`getAgeGroup` from `.planning/spec.md`); if helper not yet present, fall back to neutral defaults so this work does not block on DOB merge.
- **Background jobs:** Not explicitly excluded by user. **Default to inline updates** (on mission completion, on reflection submit) — defer async/cron until proven necessary. Re-open if we need batch recomputation.
- **Locales:** Any new user-facing copy goes through en/id/zh.
- **Toasts only:** No `window.alert/confirm/prompt`; use `toast` from sonner per project rule.

## 6. Open / explicit decisions resolved

| Decision | Resolution |
|----------|-----------|
| ZPD scope this pass | Both ZPD state + 7-day phase scaffold together (multi-session likely) |
| Consumers | Mission generator, Quest Buddy chat, Parent report, Frustration handler — all four |
| Age input | Read via DOB agent's `getAgeGroup` helper; neutral default when null |
| Backfill | Out of scope — existing children start at default ZPD baseline |
| ZPD representation | Single composite scalar / coarse band (defer multi-dim) |
| Update timing | Inline on mission completion + reflection submit (no async jobs by default) |
| Migration shape | Additive only (new tables/columns); avoid Child model edits |

## 7. Open questions (resolve in Phase 2 brainstorm)

- **ZPD scalar vs band.** Numeric (0.0–1.0) or discrete band (e.g., `emerging | developing | proficient | extending`)? Affects DB schema, prompt phrasing, and parent chart granularity.
- **Update rule.** EMA, Bayesian, or simple weighted average? Sister spec rules out EMA for interest profile, but ZPD update rule is its own decision.
- **Phase scaffold mechanism.** Hard-coded per-day difficulty hints in the prompt vs a structured `phases: [{day, difficulty, intent}]` array consumed by the prompt template? Affects prompt determinism and testability.
- **ZPD floor for mentor adjustment.** Is the floor the current ZPD level itself, or one notch below? Tradeoff: stricter floor protects against regression; looser floor gives mentor more flexibility on a bad day.
- **History retention.** How long do we keep ZPD snapshots for the parent chart? Forever, or rolling 90 days?

## 8. Non-goals

- Not rewriting the tag-classifier into 9-dim KidsArtBench.
- Not adding reliability metrics (Kappa, test-retest) in this work.
- Not introducing voice prosodic features.
- Not adding a parent-facing ZPD override / manual editor.
- Not touching the interest profile recency-weighting logic (separate scope).

## 9. Acceptance test outline (for Phase 4 verify)

- Unit: ZPD update rule covers cases — fresh child, repeat completions, frustration episode, mixed outcomes.
- Unit: mentor adjustment logic respects ZPD floor across 4 difficulty levels.
- Unit: mission generator output includes `phases[]` metadata, monotonic difficulty across days.
- Integration: `markMissionComplete` → ZPD snapshot row appears in history table.
- Integration: parent dashboard chart receives N data points from N seeded snapshots.
- Manual: generate 3 missions per locale (en/id/zh) → verify day-1 vs day-7 task copy differs in challenge.
