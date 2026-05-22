# Design: AI-vs-Human Inter-Rater Reliability (Cohen's Kappa)

**Status:** Draft for approval
**Date:** 2026-05-22
**Owner:** fauzan
**Spec source:** `.planning/specs/reliability.md`
**Pipeline phase:** 2/5 (Plan / Design)

---

## 1. Goal

Measure how well the Katalis interest-detection pipeline agrees with human expert judgement
by computing Cohen's Kappa on two label layers: **interest keys** and **tag categories**.
Surface results in an admin dashboard and weekly cron, alert when Kappa < 0.6.

This is **Approach A** (on-demand compute, append-only ratings) from the brainstorm.

## 2. Scope

In scope:
- Schema additions: `DiscoveryRating`, `ReliabilitySnapshot`, `ReliabilityAlert`.
- Pure Kappa library (multi-label macro-averaged binary Cohen's Kappa).
- Admin rating UI (queue + per-discovery rating form).
- Admin reliability dashboard (Kappa per layer, confusion, top-confused pairs, alert banner).
- Weekly Vercel cron writing snapshot and inserting alert rows when Kappa < 0.6.
- Unit + integration tests.

Out of scope (per spec):
- Test-retest, longitudinal validity, parent / external raters, auto-retrain, Fleiss' Kappa,
  multilingual rating UI, email alerts.

## 3. Architecture overview

```
+------------------+         +--------------------+        +---------------------+
| /admin/          |  GET    | /api/admin/        |  read  | DiscoveryRating     |
| reliability      +-------->+ reliability/queue  +------->+ (raw human labels)  |
| (queue + form)   |         | + kappa            |        |                     |
+--------+---------+         +---------+----------+        +----------+----------+
         | POST                        |                              |
         v                             | compute on-demand            |
+------------------+         +---------v----------+        +----------v----------+
| ratings endpoint |         |  reliability/kappa.ts (pure) |  ReliabilitySnapshot|
| writes rating    |         |  - per-label binary Kappa    |  (weekly cron)      |
+--------+---------+         |  - macro average             +----------+----------+
         |                   |  - confusion matrix          |          |
         v                   +------------------------------+          v
+------------------+                                          +-------------------+
| DiscoveryRating  |                                          | ReliabilityAlert  |
|  (snapshot of    |  <----- weekly cron also writes here     |  (kappa<0.6)      |
|   AI labels)     |                                          +-------------------+
+------------------+
```

All compute is in TypeScript request-time. SQLite holds rows. No new dependencies, no
background worker, no cache.

## 4. Data model

### 4.1 New Prisma models

```prisma
model DiscoveryRating {
  id                   String   @id @default(cuid())
  discoveryId          String
  raterUserId          String
  // Human labels submitted by the admin rater.
  humanInterestKeys    String   // JSON array of InterestKey strings
  humanTagCategories   String   // JSON array of TagCategory strings
  // AI labels snapshotted at rating time, frozen for stable Kappa.
  aiInterestKeysAtRate String   // JSON array of InterestKey strings
  aiTagCategoriesAtRate String  // JSON array of TagCategory strings
  notes                String?
  createdAt            DateTime @default(now())

  discovery            Discovery @relation(fields: [discoveryId], references: [id])
  rater                User      @relation(fields: [raterUserId], references: [id])

  @@unique([discoveryId, raterUserId])    // single admin rater per discovery
  @@index([createdAt])
}

model ReliabilitySnapshot {
  id          String   @id @default(cuid())
  computedAt  DateTime @default(now())
  layer       String   // "interest_keys" | "tag_categories"
  kappa       Float
  sampleSize  Int
  payloadJson String   // confusion matrix + per-label kappa + top-confused pairs
  triggeredBy String   // "cron" | "manual"

  @@index([layer, computedAt])
}

model ReliabilityAlert {
  id              String   @id @default(cuid())
  createdAt       DateTime @default(now())
  layer           String   // "interest_keys" | "tag_categories"
  kappa           Float
  sampleSize      Int
  snapshotId      String
  acknowledgedAt  DateTime?
  acknowledgedBy  String?

  snapshot        ReliabilitySnapshot @relation(fields: [snapshotId], references: [id])

  @@index([layer, createdAt])
  @@index([acknowledgedAt])
}
```

### 4.2 Relations on existing models
- `Discovery` gets `ratings DiscoveryRating[]`.
- `User` gets `discoveryRatings DiscoveryRating[]`.

### 4.3 Constants
- `MIN_SAMPLE_FOR_SURFACE = 50`
- `KAPPA_ADEQUACY_THRESHOLD = 0.6`
- `TAG_CATEGORIES` exported from `src/lib/ai/tag-classifier.ts` (extract if not already)
- `INTEREST_KEYS` already exported from `src/lib/interests/taxonomy.ts`

## 5. Module layout

```
src/lib/reliability/
  taxonomy.ts                 # type re-exports: Layer, LabelSet
  kappa.ts                    # pure functions (no I/O)
    - binaryKappa(pairs)
    - macroKappaMultiLabel(labelDomain, items)
    - confusionMatrix(labelDomain, items)
    - topConfusedPairs(matrix, n)
  repository.ts               # Prisma I/O
    - createDiscoveryRating(input)
    - listRatedItems(layer)
    - findNextUnratedDiscovery()    # uniform random
    - createSnapshot(payload)
    - listRecentSnapshots(layer, limit)
    - createAlert(payload)
    - listUnacknowledgedAlerts()
    - acknowledgeAlert(id, userId)
  service.ts                  # orchestration
    - computeLiveKappa(layer)
    - runSnapshotJob(triggeredBy)
    - submitRating(input)            # also snapshots AI labels
  __tests__/
    kappa.test.ts
    repository.test.ts
    service.test.ts
```

## 6. Algorithm — multi-label macro Kappa

For each `Discovery i`, AI predicts set `A_i ⊆ L` and human predicts set `H_i ⊆ L` where
`L` is the full label domain (interest keys OR tag categories).

For each label `l ∈ L`:
- Let `a_il = 1` if `l ∈ A_i`, else 0; `h_il = 1` if `l ∈ H_i`, else 0.
- Compute the 2×2 confusion matrix over all rated items for that label.
- Compute binary Cohen's Kappa: `kappa_l = (p_o − p_e) / (1 − p_e)` where `p_o` is observed
  agreement and `p_e` is chance agreement from marginals.

Final layer Kappa = mean of `kappa_l` over labels with ≥1 positive observation in either AI
or human. Labels never used by either side are skipped to avoid division-by-zero noise.

Edge cases handled:
- Empty sample → return `null`.
- `p_e = 1` (one side never picks label) → that label contributes Kappa = 0 with a flag,
  optionally excluded from average via `--strict` toggle.
- All-agree on a label with both sides positive → Kappa = 1.

## 7. Sampling strategy

`findNextUnratedDiscovery()` selects uniformly at random from `Discovery` rows that:
- have at least one AI prediction (`detectedTalents` non-null OR ≥1 `InterestSignal` row), AND
- have no `DiscoveryRating` from the requesting admin user yet.

SQLite implementation: `ORDER BY RANDOM() LIMIT 1` over the filtered set. Acceptable at the
expected scale (≤ tens of thousands of discoveries).

## 8. AI-label snapshotting

When the admin submits a rating, `submitRating(input)`:
1. Loads the `Discovery` and its `InterestSignal` rows.
2. Extracts current AI predictions:
   - Interest keys: distinct `interestKey` values across `InterestSignal` rows for this discovery.
   - Tag categories: parsed from `Discovery.detectedTalents` JSON.
3. Writes a single `DiscoveryRating` row with both human labels and the snapshotted AI labels.

This isolates the Kappa calculation from any later AI re-analysis.

## 9. API routes

```
POST /api/admin/reliability/ratings
  body: { discoveryId, humanInterestKeys[], humanTagCategories[], notes? }
  auth: admin
  returns: { ratingId }

GET  /api/admin/reliability/queue?cursor=?
  auth: admin
  returns: { discovery, aiPredictions, remainingUnrated }

GET  /api/admin/reliability/kappa?layer=interest_keys|tag_categories
  auth: admin
  returns: { kappa, sampleSize, perLabel:[{label,kappa,n}], topConfused:[{a,b,count}] }
  if sampleSize < MIN_SAMPLE_FOR_SURFACE: returns { needed: n, sampleSize }

POST /api/admin/reliability/snapshot
  auth: admin OR cron-secret header
  body: { triggeredBy: "cron"|"manual" }
  side-effects: writes ReliabilitySnapshot for both layers; if kappa<0.6 inserts ReliabilityAlert
  returns: { snapshots:[…], alertsCreated:n }

GET  /api/admin/reliability/alerts
  auth: admin
  returns: { alerts:[…unacknowledged…] }

POST /api/admin/reliability/alerts/:id/ack
  auth: admin
  returns: { ok:true }
```

## 10. UI

- `/admin/reliability` — single page, three sections:
  1. **Alerts banner** (if any unacknowledged) with ack button.
  2. **Reliability summary**: per-layer Kappa card with sample size, trend sparkline from
     last N snapshots, "rate more" CTA if below `MIN_SAMPLE_FOR_SURFACE`.
  3. **Confusion table** per layer + top-5 confused pairs.

- `/admin/reliability/rate` — single-discovery rating form:
  - Renders the `Discovery` artifact (image/story).
  - Renders AI's predicted interest keys and tag categories as chips.
  - Two multi-select inputs for human labels (interest keys, tag categories).
  - Optional notes textarea.
  - "Submit and load next" button.

Both screens admin-gated; English-only copy.

## 11. Cron

Add `vercel.json` (project currently has none):

```json
{
  "crons": [
    { "path": "/api/admin/reliability/snapshot?triggeredBy=cron", "schedule": "0 6 * * 1" }
  ]
}
```

(Monday 06:00 UTC weekly.)

Endpoint security: when Vercel cron invokes, it sends `Authorization: Bearer <CRON_SECRET>`.
The endpoint accepts EITHER admin session OR matching cron secret. `CRON_SECRET` env added
to `.env.local` (developer notes) and Vercel project env (manual step documented in plan).

## 12. Test strategy

Unit (Vitest, same harness as rest of repo):

- `kappa.test.ts`
  - empty input → null
  - perfect agreement → 1
  - perfect disagreement (single label) → 0 or −1 depending on marginals
  - chance agreement (p_o == p_e) → 0
  - one rater always positive, other random → low
  - multi-label macro: handcrafted matrix matches sklearn reference values
  - skip-empty-labels mode covered

- `repository.test.ts`
  - uses sqlite memory via Prisma test util
  - createDiscoveryRating idempotency on unique (discoveryId, raterUserId)
  - findNextUnratedDiscovery excludes already-rated for this user
  - listRatedItems returns paired labels in correct shape
  - createAlert + acknowledgeAlert lifecycle

- `service.test.ts`
  - submitRating snapshots AI labels from current `Discovery` + `InterestSignal`
  - computeLiveKappa returns `{ kappa, sampleSize, perLabel, topConfused }`
  - runSnapshotJob writes one `ReliabilitySnapshot` per layer; creates alerts when below threshold

Integration:
- `POST /api/admin/reliability/ratings` requires admin auth.
- cron endpoint accepts cron-secret header without session.

Manual:
- run the dev server, log in as admin, rate ≥3 discoveries, view dashboard.
- trigger snapshot manually via `POST /api/admin/reliability/snapshot` and confirm rows
  appear in `ReliabilitySnapshot` and `ReliabilityAlert`.

## 13. Migration / rollout

1. Develop on branch `feat/reliability-kappa` off a clean base. Do **not** start on top of
   the dirty `main` working tree — first stash or commit current edits.
2. Run `bunx prisma migrate dev --name reliability_kappa` to generate the SQLite migration.
3. No backfill needed — empty tables are the correct initial state.
4. Add `CRON_SECRET` to Vercel project env (manual step).
5. Deploy. Cron picks up on next Monday automatically.

## 14. Risks and tradeoffs

- **Single rater per item:** Kappa reflects AI-vs-this-rater bias, not ground truth. Mitigation:
  acknowledged in spec, plan for Fleiss' Kappa is in future-work doc.
- **On-demand compute scales linearly with rated set:** acceptable to ~10k rows. Plan to
  introduce snapshot caching when dashboard latency exceeds ~500 ms.
- **`ORDER BY RANDOM()` on sqlite:** O(n) scan. Fine at expected scale, will need replacing
  with reservoir sampling at >100k discoveries.
- **Empty-label macro averaging:** labels with no observation skipped from average; documented
  in `kappa.ts` to avoid future confusion.
- **AI label snapshot drift:** if a future feature reanalyzes `Discovery`, snapshotted labels
  remain — by design. Trend Kappa over time will show pipeline regression / improvement.

## 15. Open follow-ups (not this milestone)

- Test-retest reliability (separate spec).
- Longitudinal validity correlation with engagement (separate spec).
- Fleiss' Kappa (multi-rater).
- Parent / external rater pool.
- Auto-retrain or prompt-version rollback on alert.
