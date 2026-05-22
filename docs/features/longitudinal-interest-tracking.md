---
title: Longitudinal Interest Tracking
type: [feature-note, onboarding]
created: 2026-05-12
status: in-progress
categories: [ai, personalization, parent, prisma, nextjs]
related:
  - ../plans/2026-05-12-longitudinal-interest-tracking.md
  - ./longitudinal-interest-tracking.md
---

# Longitudinal Interest Tracking

Katalis now records child interest signals over time and surfaces parent-facing longitudinal insights.

## Why this exists

The original [AI discovery](../plans/2026-05-12-longitudinal-interest-tracking.md) flow was single-session: one upload produced one set of detected talents, then a quest was generated from that latest result. That works for first-run personalization, but it cannot distinguish a fleeting interest from a pattern that keeps appearing across discoveries, quests, mission completions, and explicit parent ratings.

This feature adds a lightweight interest memory layer: event-level signals feed aggregate child profiles, and those profiles can inform mission recommendations and parent reflection. The product framing must stay non-deterministic: these are current interest patterns, not permanent labels or psychological assessments.

## What changed

### Data layer

The Prisma schema now includes four longitudinal-interest models:

- `InterestSignal` — append-only event ledger for observations like discovery analysis, quest completion, mission completion, reflections, gallery activity, and explicit ratings.
- `ChildInterestProfile` — aggregate profile per child and interest key.
- `MissionInterestAssessment` — audit-friendly record of mission-level explicit ratings and engagement.
- `InterestAuditEvent` — audit log for signal ingestion, profile rebuilds, ratings, and seed data.

The SQLite schema stores metadata as serialized `TEXT`, matching existing project conventions for JSON-like fields.

### Backend services

Core logic lives under `src/lib/interests/`:

- `taxonomy.ts` defines fixed v1 interest keys, signal sources, and dimensions.
- `repository.ts` persists signals, profiles, assessments, and audit events.
- `scoring.ts` computes score and trend using recency weighting.
- `profile-service.ts` rebuilds aggregate profiles from signals.
- `ingest-service.ts` writes signals, audits ingestion, and rebuilds profiles.
- `explicit-rating-service.ts` maps parent/child ratings into signals.
- `discovery-mapper.ts` and `quest-mapper.ts` map existing discovery/quest text into interest signals.
- `parent-insight-service.ts` returns deterministic parent insight data without calling an LLM.

### API endpoints

New endpoints:

```http
POST /api/interests/rating
GET /api/parent/children/[childId]/interests
```

`POST /api/interests/rating` supports parent and child raters. It verifies actor authorization and also verifies that the submitted mission belongs to the submitted child before writing the rating. Parent raters must pass `verifyParentChildLink`; child raters must have a matching child session.

`GET /api/parent/children/[childId]/interests` verifies the parent-child link before returning top interests, recent signals, and suggested questions.

### Route integrations

Existing routes now emit best-effort interest signals:

- `src/app/api/discovery/save/route.ts` emits `discovery_analysis` signals.
- `src/app/api/quest/generate/route.ts` emits `quest_started` signals.
- `src/app/api/quest/[id]/mission/[missionId]/route.ts` emits `mission_completed` signals.
- `src/app/api/quest/[id]/complete/route.ts` emits `quest_completed` signals.

These integrations catch and log interest-ingestion errors so the primary user action still succeeds.

### Parent UI

Parent-facing components live under `src/components/parent/`:

- `InterestInsights.tsx` renders top interest cards, confidence, trend, signal count, suggested questions, and a recent signal audit table.
- `InterestInsightsClient.tsx` fetches child insights from the parent API and handles loading, error, and retry states.
- `MissionInterestRating.tsx` renders an accessible 1–5 rating control that posts parent feedback to `/api/interests/rating`.

`src/components/parent/ChildCard.tsx` now embeds interest insights for each child. `src/app/[locale]/parent/quest/[id]/page.tsx` now renders the rating control for the current mission.

## Scoring model v1

Interest signals are deterministic and intentionally simple. Contribution is:

```text
strength * confidence * dimensionWeight * recencyWeight
```

Recency weights:

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

Stored profile scores clamp to `0..1`. Negative signals lower the score toward zero rather than producing a negative child-interest label.

Trend compares the last 30 days against the previous 30 days:

```text
rising if delta > 0.15
falling if delta < -0.15
stable otherwise
```

## Explicit rating scale

Parent and child ratings map to signal strength as follows:

```text
1 -> -0.8
2 -> -0.3
3 -> 0.1
4 -> 0.6
5 -> 1.0
```

Parent ratings use source `explicit_parent_rating` and dimension `engagement`. Child ratings use source `explicit_child_rating` and dimension `joy`.

## Safety and privacy guardrails

This feature should never describe a child with permanent labels like “is a scientist” or “is not artistic.” UI and parent reports should use language like “currently showing interest in…” or “appeared in recent activities.”

The system stores derived signals and small metadata summaries, not duplicated raw child content. Deletion cascades are configured for child-owned signal/profile/assessment data. Parent APIs verify the parent-child link before returning insights.

## Known limitations

- Taxonomy v1 is fixed in code; there is no admin editor.
- Interest extraction uses deterministic keyword mapping, not a calibrated classifier.
- Parent dashboard currently fetches insights once per child card, which is acceptable for a small number of children but not optimal for large cohorts.
- UI strings are hardcoded English in the first version and should move into `next-intl` messages during polish.
- Existing full test suite is blocked by unrelated `src/app/[locale]/discover/__tests__/page.test.tsx` failures.
- Repo-wide dependency audit reports high advisories, including Next.js advisories, and should be addressed before production release.

## Verification snapshot

Targeted interest tests pass:

```bash
bun run test -- src/lib/interests src/app/api/interests/__tests__/rating.test.ts "src/app/api/parent/children/[childId]/__tests__/interests.test.ts" "src/app/api/quest/[id]/complete/__tests__/complete.test.ts"
bun run test -- src/components/parent/InterestInsights.test.tsx src/components/parent/InterestInsightsClient.test.tsx src/components/parent/MissionInterestRating.test.tsx src/app/api/interests/__tests__/rating.test.ts
bun run typecheck
DATABASE_URL="file:./dev.db" bunx prisma validate
```

Full `bun run test` currently fails only in `src/app/[locale]/discover/__tests__/page.test.tsx`, where the page remains on its loading spinner in tests.

## Developer notes

When adding a new signal source, prefer this flow:

1. Add or reuse a mapper that returns `interestKey`, `dimension`, `strength`, `confidence`, and optional metadata.
2. Call `ingestInterestSignals` with the correct source and entity id.
3. Let ingestion write audit data and rebuild the child profile.
4. Keep primary route behavior resilient: interest ingestion failure should not break discovery, quest generation, or mission completion unless the feature explicitly depends on it.

When adding UI around this data, avoid raw numeric certainty for children. Parent-facing confidence can be shown, but child-facing UI should emphasize exploration and reflection.
