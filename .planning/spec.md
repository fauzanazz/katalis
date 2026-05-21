# Spec: Age Stratification

**Status:** Draft for approval
**Date:** 2026-05-22
**Owner:** fauzan
**Pipeline phase:** 1/5 (Spec)

---

## 1. What we're building

Add age-band awareness across the Katalis stack so children's experience adapts to their
developmental stage (3-6, 7-9, 10-12). Touches schema, Discover input UI, Quest Buddy mentor
prompt + frustration scoring, and Mission generator duration caps.

The single new primary input is `Child.dateOfBirth`; all band logic derives from it.

## 2. Who this is for

- **Children (3-12)** — get age-appropriate input modalities and AI behavior.
- **Parents** — input DoB during onboarding and backfill prompts; see age band on dashboard.
- **System (Mentor / Discover / Mission)** — branches on `ageGroup` for prompts, thresholds,
  and duration caps.

## 3. Success criteria (observable)

1. **Schema coverage** — every Child row reachable via DB query has either a non-null
   `dateOfBirth` or a documented "unset → neutral default" code path; no crashes.
2. **Modality gating** — Discover input UI in each age band:
   - 3-6: photo-only (drawing upload).
   - 7-9: photo + voice.
   - 10-12: photo + voice + text/story prompt.
   E2E test asserts disabled controls per band.
3. **Mentor adaptation** — `getMentorSystemPrompt(child)` returns measurably different prompt
   string per band; frustration scorer thresholds (`none/low/medium/high`) shift per band.
   Unit tests assert branch divergence.
4. **Mission duration caps** — Mission generator output includes `estimatedMinutes` ≤ band cap:
   3-6 ≤ 10, 7-9 ≤ 20, 10-12 ≤ 40. Schema test on generator output.
5. **Backfill** — existing Child rows remain functional; parent sees a one-time DoB prompt on
   `/parent` dashboard until filled; active mentor sessions don't crash on null DoB.

## 4. Out of scope

- Formal age verification (no ID / document checks). Trust parent input.
- Voice prosodic frustration sensing (voice modality enabled, emotional analysis deferred).
- Auto re-classification mid-mission on birthday crossover. Re-evaluate on next session start.
- KidsArtBench 9-dimensional scoring and Cohen's Kappa reliability harness — separate research effort.

## 5. Constraints

- **Migration:** `dateOfBirth` is **nullable** initially. New Child creation forms require it.
  Legacy null rows trigger a backfill prompt on the parent dashboard.
- **Storage model:** Persist `dateOfBirth` (Date) only. `ageGroup` is a **derived helper**
  computed on every read via pure function `getAgeGroup(dob, now)`. No cached enum, no cron.
- **Null handling:** `getAgeGroup(null)` returns `unknown`. All consumers (mentor, mission,
  Discover) must map `unknown → neutral defaults` (currently equivalent to the existing
  hardcoded "aged 6-12" behavior, preserving current UX until backfill).
- **Privacy:** Store DoB as Date. No special encryption beyond standard at-rest DB encryption.
- **Tech stack:** Next.js App Router, Prisma, existing AI provider abstraction, sonner toasts,
  three locales (en/id/zh).

## 6. Open / explicit decisions resolved

| Decision | Resolution |
|----------|-----------|
| DoB on schema | Nullable initially |
| Storage of ageGroup | Derived on read, not persisted |
| Birthday crossover mid-mission | Hold current band until mission ends |
| Voice modality | Enabled for 7-9 and 10-12; emotional analysis deferred |
| Modality gating mechanism | Hard UI disable + server-side validation reject |
| Locales | All three (en/id/zh) updated for any new copy |

## 7. Non-goals

- We are **not** rewriting the existing tag-classifier into 9-dim KidsArtBench.
- We are **not** adding reliability metrics (Kappa, test-retest) in this work.
- We are **not** introducing voice prosodic features.
- We are **not** building a separate "age group override" admin feature beyond what parent
  onboarding form provides.

## 8. Acceptance test outline (for Phase 4 verify)

- Migration runs cleanly on a copy of prod schema with existing Child rows.
- Unit: `getAgeGroup` covers all bands + null + future DoB + 13+ edge.
- Unit: mentor prompt + frustration thresholds differ per band.
- Unit: mission generator caps duration per band.
- E2E (or integration): Discover UI shows only allowed input controls per band.
- E2E: parent dashboard shows DoB backfill prompt for null Child; can submit DoB and prompt
  disappears.
- Manual: visit `/parent` with a backfilled child of each band; trigger Discover + Quest;
  confirm visible differences.
