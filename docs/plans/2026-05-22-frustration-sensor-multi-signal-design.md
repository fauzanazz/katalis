# Design: Frustration Sensor Multi-Signal Upgrade

**Date:** 2026-05-22
**Status:** Approved
**Spec:** `.planning/specs/spec-frustration-multi-signal.md`

## Summary

Extend existing 3-signal frustration detector (keyword + message count + duration) with:
- Inactivity signal (gap between child messages)
- Edit behavior signal (delete/redo count from quest editor hook)
- Soft check-in intervention (ask "how feeling?" at medium before offering adjustment)
- Age-adaptive thresholds (using existing `Child.dateOfBirth`)

Approach: **Extend in-place** — optional fields on `FrustrationContext`, `checkinPending` state on `MentorSession`, `ageGroup` derived in route from `dateOfBirth`.

## New Signals

### Inactivity
- Client sends `lastInputAt: ISO datetime` in message body
- Route computes `inactivityMinutes = now - lastInputAt`
- Score: ≥5min → +2, ≥10min → +4

### Edit Behavior
- Client sends `editEvents: { deletes: number; redos: number }` in message body
- Score: `deletes + redos` ≥3 → +1, ≥6 → +2

### Age-Adaptive Thresholds
- Route derives `ageGroup` from `Child.dateOfBirth`:
  - `young`: 6–8 years → thresholds lowered (medium at 4, high at 7)
  - `middle`: 9–10 years → default thresholds
  - `older`: 11–12 years → thresholds raised (medium at 6, high at 10)
- `ageGroup` passed in `FrustrationContext`

### Soft Check-In Intervention
- New `MentorSession.checkinPending Boolean @default(false)` column
- Escalation state machine:
  ```
  frustration = medium, checkinPending = false
    → set checkinPending = true
    → mentor asks "how are you feeling?" (NOT offerAdjustment)
  
  frustration = medium/high, checkinPending = true
    → reset checkinPending = false
    → offerAdjustment = true (Small Adjustment)
  ```

## Schema Changes

```prisma
// MentorSession — add:
checkinPending Boolean @default(false)

// Child.dateOfBirth already exists (DateTime?)
```

## Zod Schema Changes (`mentor-schemas.ts`)

```ts
// SendMessageInputSchema — extend with optional behavioral signals:
behavioralSignals: z.object({
  lastInputAt: z.string().datetime().optional(),
  editEvents: z.object({
    deletes: z.number().int().min(0),
    redos: z.number().int().min(0),
  }).optional(),
}).optional(),
```

## FrustrationContext Changes (`frustration.ts`)

```ts
interface FrustrationContext {
  messageCount: number
  childMessageCount: number
  sessionDurationMinutes: number
  recentChildMessages: string[]
  // new optional:
  inactivityMinutes?: number
  editEvents?: { deletes: number; redos: number }
  ageGroup?: 'young' | 'middle' | 'older'
  pendingCheckin?: boolean  // from MentorSession.checkinPending
}
```

## Route Changes (`/api/mentor/message/route.ts`)

1. Extract `behavioralSignals` from parsed body
2. Compute `inactivityMinutes` from `lastInputAt`
3. Derive `ageGroup` from `session.child.dateOfBirth`
4. Pass all to `detectFrustration()`
5. After frustration result:
   - If `medium` and `!mentorSession.checkinPending` → update `checkinPending = true`, do NOT set `offerAdjustment`
   - If `medium/high` and `mentorSession.checkinPending` → update `checkinPending = false`, set `offerAdjustment = true`

## Files Touched

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add `checkinPending` to `MentorSession` |
| `prisma/migrations/` | New migration file |
| `src/lib/ai/mentor-schemas.ts` | Add `behavioralSignals` to `SendMessageInputSchema` |
| `src/lib/ai/mentor/frustration.ts` | New context fields + scoring + age thresholds |
| `src/app/api/mentor/message/route.ts` | Extract signals, derive ageGroup, handle checkin state |
| `src/lib/ai/mentor/__tests__/frustration.test.ts` | New unit tests |

## Scoring Table (final)

| Signal | Condition | Score |
|--------|-----------|-------|
| Keywords | ≥2 hits | +1 |
| Keywords | ≥4 hits | +3 |
| Msg count (default) | ≥6 child msgs | +1 |
| Msg count (default) | ≥10 child msgs | +3 |
| Duration | ≥15 min | +1 |
| Duration | ≥30 min | +3 |
| Inactivity | ≥5 min gap | +2 |
| Inactivity | ≥10 min gap | +4 |
| Edit behavior | ≥3 deletes+redos | +1 |
| Edit behavior | ≥6 deletes+redos | +2 |

Age multipliers applied to msg count + duration thresholds only (not inactivity/edit).

## Level Thresholds (unchanged)
- `none`: score 0
- `low`: score 1–2
- `medium`: score 3–4
- `high`: score ≥5
