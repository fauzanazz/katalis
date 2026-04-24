# Creativity Motivation System (Badges) — Sprint 5 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use parallel-plan-execution to implement this plan task-by-task.

**Goal:** Build a rule-based badge engine that rewards children for creativity, reflection, persistence, and progress during their quest journey.

**Architecture:** Badge definitions live in code as typed constants. A pure-function evaluation engine checks conditions against a context snapshot. ChildBadge records in SQLite track earned badges (one per child per badge). Badge checks are triggered server-side from existing routes (mission complete, reflection submit, mentor message, adjustment accept). Client fetches earned badges via GET /api/badges and renders a BadgeGrid + new-badge celebration toast.

**Tech Stack:** Prisma (SQLite), Zod, next-intl (en/id/zh), shadcn Button, lucide-react icons

---

## Session 1: Data Layer (Tasks 1–4)
Exit criteria: Prisma models + migration, Zod schemas, seed data, build passes

### Task 1: Add Badge & ChildBadge Prisma models + migration

**Files:**
- Modify: `prisma/schema.prisma`

**Step 1: Add Badge and ChildBadge models to prisma/schema.prisma**

Append after the `ReflectionEntry` model:

```prisma
model Badge {
  id          String       @id @default(cuid())
  slug        String       @unique // e.g. "first_step", "week_warrior"
  category    String       // "progress", "creativity", "reflection", "mentorship"
  tier        String       @default("bronze") // "bronze", "silver", "gold"
  icon        String       // emoji identifier, e.g. "🎯"
  createdAt   DateTime     @default(now())
  childBadges ChildBadge[]

  @@index([category])
}

model ChildBadge {
  id        String   @id @default(cuid())
  childId   String
  badgeSlug String   // references Badge.slug — not a FK to allow code-first definitions
  questId   String?  // Quest context when earned (nullable for lifetime badges)
  trigger   String   // "mission_complete", "reflection", "mentor_message", "adjustment"
  metadata  String?  // JSON stored as text — additional context (e.g. mission day)
  createdAt DateTime @default(now())

  @@unique([childId, badgeSlug]) // Each badge earned once per child
  @@index([childId])
  @@index([badgeSlug])
}
```

Note: We use `badgeSlug` (not `badgeId` FK) because badge definitions are code-first — they live in `src/lib/badges/definitions.ts`, not in the database. This avoids needing to seed Badge rows and keeps definitions version-controlled.

**Step 2: Generate and apply migration**

Run: `bunx prisma migrate dev --name add_badge_system`
Expected: Migration created and applied successfully.

**Step 3: Verify migration**

Run: `bunx prisma generate`
Expected: Prisma client regenerated.

**Step 4: Commit**

```bash
git add prisma/
git commit -m "feat: add Badge and ChildBadge Prisma models"
```

---

### Task 2: Create Zod schemas for badge types

**Files:**
- Create: `src/lib/badges/schemas.ts`

**Step 1: Create the schemas file**

```typescript
import { z } from "zod";

/** Badge category — groups badges thematically */
export const BadgeCategorySchema = z.enum([
  "progress",
  "creativity",
  "reflection",
  "mentorship",
]);

/** Badge tier — rarity level */
export const BadgeTierSchema = z.enum(["bronze", "silver", "gold"]);

/** Badge trigger — what action earned this badge */
export const BadgeTriggerSchema = z.enum([
  "mission_complete",
  "reflection",
  "mentor_message",
  "adjustment",
]);

/** A badge definition — lives in code, not the database */
export const BadgeDefinitionSchema = z.object({
  slug: z.string(),
  category: BadgeCategorySchema,
  tier: BadgeTierSchema,
  icon: z.string(),
  /** i18n key prefix: badges.<slug>.name / badges.<slug>.description */
});

/** Context passed to the badge evaluation engine */
export const BadgeContextSchema = z.object({
  childId: z.string().cuid(),
  questId: z.string().cuid().optional(),
  completedMissionCount: z.number().int().min(0),
  totalMissionCount: z.number().int().min(0),
  reflectionCount: z.number().int().min(0),
  questReflectionCount: z.number().int().min(0),
  hasUsedMentorChat: z.boolean(),
  adjustmentCount: z.number().int().min(0),
  hasVoiceReflection: z.boolean(),
  existingBadgeSlugs: z.array(z.string()),
});

/** A badge earned by a child — returned by the API */
export const EarnedBadgeSchema = z.object({
  slug: z.string(),
  category: BadgeCategorySchema,
  tier: BadgeTierSchema,
  icon: z.string(),
  earnedAt: z.string(), // ISO date
  questId: z.string().nullable(),
  isNew: z.boolean().default(false),
});

export type BadgeCategory = z.infer<typeof BadgeCategorySchema>;
export type BadgeTier = z.infer<typeof BadgeTierSchema>;
export type BadgeTrigger = z.infer<typeof BadgeTriggerSchema>;
export type BadgeDefinition = z.infer<typeof BadgeDefinitionSchema>;
export type BadgeContext = z.infer<typeof BadgeContextSchema>;
export type EarnedBadge = z.infer<typeof EarnedBadgeSchema>;
```

**Step 2: Commit**

```bash
git add src/lib/badges/schemas.ts
git commit -m "feat: add Zod schemas for badge system"
```

---

### Task 3: Create badge definitions

**Files:**
- Create: `src/lib/badges/definitions.ts`

**Step 1: Create the definitions file**

```typescript
/**
 * Badge definitions — code-first, version-controlled.
 *
 * Each badge has a slug matching an i18n key: badges.<slug>.name / badges.<slug>.description
 * Badge conditions are evaluated by the engine in engine.ts.
 */

import type { BadgeCategory, BadgeDefinition, BadgeTier } from "./schemas";

interface BadgeDef extends BadgeDefinition {
  /** i18n key for name: badges.<slug>.name */
  nameKey: string;
  /** i18n key for description: badges.<slug>.description */
  descriptionKey: string;
}

/** All badge definitions. Order determines display order. */
export const BADGE_DEFINITIONS: readonly BadgeDef[] = [
  {
    slug: "first_step",
    category: "progress",
    tier: "bronze",
    icon: "🎯",
    nameKey: "badges.first_step.name",
    descriptionKey: "badges.first_step.description",
  },
  {
    slug: "week_warrior",
    category: "progress",
    tier: "gold",
    icon: "🏆",
    nameKey: "badges.week_warrior.name",
    descriptionKey: "badges.week_warrior.description",
  },
  {
    slug: "reflector",
    category: "reflection",
    tier: "bronze",
    icon: "💭",
    nameKey: "badges.reflector.name",
    descriptionKey: "badges.reflector.description",
  },
  {
    slug: "deep_thinker",
    category: "reflection",
    tier: "silver",
    icon: "🧠",
    nameKey: "badges.deep_thinker.name",
    descriptionKey: "badges.deep_thinker.description",
  },
  {
    slug: "storyteller",
    category: "reflection",
    tier: "silver",
    icon: "🎙️",
    nameKey: "badges.storyteller.name",
    descriptionKey: "badges.storyteller.description",
  },
  {
    slug: "trailblazer",
    category: "mentorship",
    tier: "bronze",
    icon: "💬",
    nameKey: "badges.trailblazer.name",
    descriptionKey: "badges.trailblazer.description",
  },
  {
    slug: "creative_adapter",
    category: "creativity",
    tier: "silver",
    icon: "🔄",
    nameKey: "badges.creative_adapter.name",
    descriptionKey: "badges.creative_adapter.description",
  },
  {
    slug: "persistent_explorer",
    category: "creativity",
    tier: "gold",
    icon: "💪",
    nameKey: "badges.persistent_explorer.name",
    descriptionKey: "badges.persistent_explorer.description",
  },
] as const;

/** Lookup map by slug */
export const BADGE_BY_SLUG = new Map(
  BADGE_DEFINITIONS.map((b) => [b.slug, b]),
);

/** All slugs for quick iteration */
export const ALL_BADGE_SLUGS = BADGE_DEFINITIONS.map((b) => b.slug);

/** Get badge definition by slug */
export function getBadgeDef(slug: string): BadgeDef | undefined {
  return BADGE_BY_SLUG.get(slug);
}
```

**Step 2: Commit**

```bash
git add src/lib/badges/definitions.ts
git commit -m "feat: add badge definitions (8 badges across 4 categories)"
```

---

### Task 4: Update seed file

**Files:**
- Modify: `prisma/seed.ts`

**Step 1: Add ChildBadge cleanup to seed**

Add `await prisma.childBadge.deleteMany();` after the `reflectionEntry` deletion line (line 15 area). The deletion order must respect dependencies — ChildBadge should be deleted before Child.

In the cleanup section, add this line:
```typescript
await prisma.childBadge.deleteMany();
```

Place it after `await prisma.reflectionEntry.deleteMany();` and before `await prisma.adjustmentEvent.deleteMany();`.

**Step 2: Commit**

```bash
git add prisma/seed.ts
git commit -m "chore: add ChildBadge cleanup to seed"
```

---

## Session 2: Badge Engine (Tasks 5–6)
Exit criteria: Pure-function badge evaluation engine + barrel export, build passes

### Task 5: Build the rule-based badge evaluation engine

**Files:**
- Create: `src/lib/badges/engine.ts`

**Step 1: Create the engine**

```typescript
/**
 * Badge evaluation engine — pure function, rule-based v1.
 *
 * Takes a BadgeContext snapshot and returns slugs of newly earned badges.
 * Follows the same pattern as src/lib/ai/mentor/frustration.ts:
 *   - Pure function with typed context input
 *   - Each badge has an independent condition
 *   - Returns only NEW badges (not already earned)
 */

import type { BadgeContext } from "./schemas";
import { ALL_BADGE_SLUGS } from "./definitions";

/**
 * A single badge rule: returns true if the child has earned this badge.
 *
 * Each rule is independent — the engine evaluates all rules and filters
 * out already-earned badges.
 */
type BadgeRule = (ctx: BadgeContext) => boolean;

/** Badge evaluation rules, keyed by slug. */
const RULES: Record<string, BadgeRule> = {
  /** Complete your first mission */
  first_step: (ctx) => ctx.completedMissionCount >= 1,

  /** Complete all 7 days of a quest */
  week_warrior: (ctx) =>
    ctx.totalMissionCount > 0 &&
    ctx.completedMissionCount >= ctx.totalMissionCount,

  /** Write your first daily reflection */
  reflector: (ctx) => ctx.reflectionCount >= 1,

  /** Reflect on 3+ days within a single quest */
  deep_thinker: (ctx) => ctx.questReflectionCount >= 3,

  /** Share a voice reflection */
  storyteller: (ctx) => ctx.hasVoiceReflection,

  /** Use the Quest Buddy mentor chat */
  trailblazer: (ctx) => ctx.hasUsedMentorChat,

  /** Accept a mission adjustment (constructive divergence) */
  creative_adapter: (ctx) => ctx.adjustmentCount >= 1,

  /** Persist through 2+ adjustments (grit and determination) */
  persistent_explorer: (ctx) => ctx.adjustmentCount >= 2,
};

/**
 * Evaluate which new badges a child has earned.
 *
 * @param context - Snapshot of the child's current state
 * @returns Array of badge slugs that are newly earned (not in existingBadgeSlugs)
 */
export function evaluateBadges(context: BadgeContext): string[] {
  const earned: string[] = [];

  for (const slug of ALL_BADGE_SLUGS) {
    // Skip already-earned badges
    if (context.existingBadgeSlugs.includes(slug)) continue;

    const rule = RULES[slug];
    if (rule && rule(context)) {
      earned.push(slug);
    }
  }

  return earned;
}
```

**Step 2: Commit**

```bash
git add src/lib/badges/engine.ts
git commit -m "feat: add rule-based badge evaluation engine"
```

---

### Task 6: Create barrel export

**Files:**
- Create: `src/lib/badges/index.ts`

**Step 1: Create the barrel file**

```typescript
/**
 * Badge system — barrel export.
 *
 * Usage:
 *   import { evaluateBadges, getBadgeDef, BADGE_DEFINITIONS } from "@/lib/badges";
 */

export { evaluateBadges } from "./engine";
export {
  BADGE_DEFINITIONS,
  BADGE_BY_SLUG,
  ALL_BADGE_SLUGS,
  getBadgeDef,
} from "./definitions";
export type {
  BadgeCategory,
  BadgeTier,
  BadgeTrigger,
  BadgeDefinition,
  BadgeContext,
  EarnedBadge,
} from "./schemas";
```

**Step 2: Verify build**

Run: `bun run build`
Expected: Build succeeds (no files import from badges yet, so no errors).

**Step 3: Commit**

```bash
git add src/lib/badges/index.ts
git commit -m "feat: add badge system barrel export"
```

---

## Session 3: API Routes + Integration (Tasks 7–12)
Exit criteria: GET /api/badges route, badge checks integrated into mission complete / reflection / mentor / adjust routes, build passes

### Task 7: Create helper to build BadgeContext from DB

**Files:**
- Create: `src/lib/badges/build-context.ts`

**Step 1: Create the context builder**

This utility gathers the child's state from the database to build a BadgeContext for evaluation. It's called by routes after their main operation.

```typescript
/**
 * Build a BadgeContext from the database for a given child.
 *
 * Gathers all the signals the badge engine needs:
 * - Completed mission count (lifetime + quest-scoped)
 * - Reflection count (lifetime + quest-scoped)
 * - Mentor chat usage
 * - Adjustment count
 * - Voice reflection usage
 * - Already-earned badge slugs
 */

import { prisma } from "@/lib/db";
import type { BadgeContext } from "./schemas";

interface BuildContextOptions {
  childId: string;
  questId?: string;
}

export async function buildBadgeContext({
  childId,
  questId,
}: BuildContextOptions): Promise<BadgeContext> {
  // Fetch all quests for this child to count completed missions
  const quests = await prisma.quest.findMany({
    where: { childId },
    select: {
      id: true,
      missions: {
        select: { status: true },
      },
    },
  });

  let completedMissionCount = 0;
  let totalMissionCount = 0;
  let questMissionTotal = 0;
  let questMissionCompleted = 0;

  for (const quest of quests) {
    const completed = quest.missions.filter(
      (m) => m.status === "completed",
    ).length;
    completedMissionCount += completed;
    totalMissionCount += quest.missions.length;

    if (questId && quest.id === questId) {
      questMissionTotal = quest.missions.length;
      questMissionCompleted = completed;
    }
  }

  // If no specific questId, use totals
  if (!questId) {
    questMissionTotal = totalMissionCount;
    questMissionCompleted = completedMissionCount;
  }

  // Reflection counts
  const reflectionCount = await prisma.reflectionEntry.count({
    where: { childId },
  });

  let questReflectionCount = 0;
  if (questId) {
    questReflectionCount = await prisma.reflectionEntry.count({
      where: { childId, questId },
    });
  } else {
    questReflectionCount = reflectionCount;
  }

  // Voice reflection check
  const voiceReflectionCount = await prisma.reflectionEntry.count({
    where: { childId, type: "voice" },
  });

  // Mentor chat usage
  const mentorSessionCount = await prisma.mentorSession.count({
    where: { childId },
  });

  // Adjustment count (lifetime)
  const adjustmentCount = await prisma.adjustmentEvent.count({
    where: { session: { childId } },
  });

  // Already-earned badges
  const earnedBadges = await prisma.childBadge.findMany({
    where: { childId },
    select: { badgeSlug: true },
  });
  const existingBadgeSlugs = earnedBadges.map((b) => b.badgeSlug);

  return {
    childId,
    questId,
    completedMissionCount: questMissionCompleted,
    totalMissionCount: questMissionTotal,
    reflectionCount,
    questReflectionCount,
    hasUsedMentorChat: mentorSessionCount > 0,
    adjustmentCount,
    hasVoiceReflection: voiceReflectionCount > 0,
    existingBadgeSlugs,
  };
}
```

**Step 2: Update barrel export**

Add to `src/lib/badges/index.ts`:
```typescript
export { buildBadgeContext } from "./build-context";
```

**Step 3: Commit**

```bash
git add src/lib/badges/build-context.ts src/lib/badges/index.ts
git commit -m "feat: add buildBadgeContext DB helper"
```

---

### Task 8: Create helper to award badges and return results

**Files:**
- Create: `src/lib/badges/award.ts`

**Step 1: Create the award helper**

This function takes newly earned badge slugs, creates ChildBadge records, and returns formatted EarnedBadge objects for the API response.

```typescript
/**
 * Award badges to a child — creates ChildBadge records in the database.
 *
 * Called after evaluateBadges() returns new badge slugs.
 * Returns EarnedBadge[] for inclusion in API responses.
 */

import { prisma } from "@/lib/db";
import { getBadgeDef } from "./definitions";
import type { BadgeTrigger, EarnedBadge } from "./schemas";

interface AwardBadgesOptions {
  childId: string;
  newlyEarnedSlugs: string[];
  trigger: BadgeTrigger;
  questId?: string;
}

export async function awardBadges({
  childId,
  newlyEarnedSlugs,
  trigger,
  questId,
}: AwardBadgesOptions): Promise<EarnedBadge[]> {
  if (newlyEarnedSlugs.length === 0) return [];

  const results: EarnedBadge[] = [];

  for (const slug of newlyEarnedSlugs) {
    const def = getBadgeDef(slug);
    if (!def) continue;

    await prisma.childBadge.create({
      data: {
        childId,
        badgeSlug: slug,
        questId: questId ?? null,
        trigger,
        metadata: JSON.stringify({ trigger }),
      },
    });

    results.push({
      slug,
      category: def.category,
      tier: def.tier,
      icon: def.icon,
      earnedAt: new Date().toISOString(),
      questId: questId ?? null,
      isNew: true,
    });
  }

  return results;
}
```

**Step 2: Update barrel export**

Add to `src/lib/badges/index.ts`:
```typescript
export { awardBadges } from "./award";
```

**Step 3: Commit**

```bash
git add src/lib/badges/award.ts src/lib/badges/index.ts
git commit -m "feat: add awardBadges helper for persisting earned badges"
```

---

### Task 9: Create GET /api/badges route

**Files:**
- Create: `src/app/api/badges/route.ts`

**Step 1: Create the badges API route**

```typescript
import { NextResponse } from "next/server";
import { getChildSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { BADGE_DEFINITIONS } from "@/lib/badges";

/**
 * GET /api/badges
 *
 * Returns all badge definitions with the child's earned status.
 * Requires child authentication.
 */
export async function GET() {
  try {
    const session = await getChildSession();
    if (!session) {
      return NextResponse.json(
        { error: "unauthorized", message: "Authentication required" },
        { status: 401 },
      );
    }

    // Fetch earned badges for this child
    const earnedBadges = await prisma.childBadge.findMany({
      where: { childId: session.childId },
      select: {
        badgeSlug: true,
        createdAt: true,
        questId: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const earnedSlugSet = new Set(earnedBadges.map((b) => b.badgeSlug));
    const earnedBySlug = new Map(
      earnedBadges.map((b) => [
        b.badgeSlug,
        { earnedAt: b.createdAt.toISOString(), questId: b.questId },
      ]),
    );

    // Build response: all definitions with earned status
    const badges = BADGE_DEFINITIONS.map((def) => {
      const earned = earnedBySlug.get(def.slug);
      return {
        slug: def.slug,
        category: def.category,
        tier: def.tier,
        icon: def.icon,
        earned: earnedSlugSet.has(def.slug),
        earnedAt: earned?.earnedAt ?? null,
        questId: earned?.questId ?? null,
      };
    });

    return NextResponse.json({ badges });
  } catch (error) {
    console.error("Badges fetch error:", error);
    return NextResponse.json(
      { error: "server_error", message: "Failed to fetch badges" },
      { status: 500 },
    );
  }
}
```

**Step 2: Commit**

```bash
git add src/app/api/badges/route.ts
git commit -m "feat: add GET /api/badges route"
```

---

### Task 10: Integrate badge check into mission complete route

**Files:**
- Modify: `src/app/api/quest/[id]/mission/[missionId]/route.ts`

**Step 1: Add badge imports**

At the top of the file, add:
```typescript
import { buildBadgeContext, evaluateBadges, awardBadges } from "@/lib/badges";
```

**Step 2: Add badge check after mission complete transaction**

After the successful `NextResponse.json(...)` for the "complete" action (around line 230), modify the response to include badge checking. Replace the complete action's return statement with badge-aware logic.

Inside the `if (action === "complete")` block, after the `result` from `$transaction`, add badge evaluation:

```typescript
      // Check for newly earned badges
      const badgeCtx = await buildBadgeContext({
        childId: session.childId,
        questId,
      });
      const newBadgeSlugs = evaluateBadges(badgeCtx);
      const newBadges = await awardBadges({
        childId: session.childId,
        newlyEarnedSlugs: newBadgeSlugs,
        trigger: "mission_complete",
        questId,
      });

      return NextResponse.json({
        success: true,
        mission: {
          id: result.completedMission.id,
          day: result.completedMission.day,
          status: result.completedMission.status,
          proofPhotoUrl: result.completedMission.proofPhotoUrl,
        },
        nextDayUnlocked: result.nextDayUnlocked,
        questCompleted: result.questCompleted,
        newBadges: newBadges.length > 0 ? newBadges : undefined,
      });
```

This replaces the existing return statement for the complete action.

**Step 3: Commit**

```bash
git add src/app/api/quest/[id]/mission/[missionId]/route.ts
git commit -m "feat: integrate badge evaluation into mission complete"
```

---

### Task 11: Integrate badge check into reflection route

**Files:**
- Modify: `src/app/api/reflection/daily/route.ts`

**Step 1: Add badge imports**

At the top of the file, add:
```typescript
import { buildBadgeContext, evaluateBadges, awardBadges } from "@/lib/badges";
```

**Step 2: Add badge check after reflection is saved**

After the reflection is successfully created (the `prisma.reflectionEntry.create` call), add badge evaluation before the return:

```typescript
    // Check for newly earned badges
    const badgeCtx = await buildBadgeContext({
      childId: session.childId,
      questId,
    });
    const newBadgeSlugs = evaluateBadges(badgeCtx);
    const newBadges = await awardBadges({
      childId: session.childId,
      newlyEarnedSlugs: newBadgeSlugs,
      trigger: "reflection",
      questId,
    });

    return NextResponse.json({
      success: true,
      reflection: {
        id: reflectionEntry.id,
        type: reflectionEntry.type,
        aiSummary: reflectionEntry.aiSummary
          ? JSON.parse(reflectionEntry.aiSummary)
          : null,
      },
      newBadges: newBadges.length > 0 ? newBadges : undefined,
    });
```

This replaces the existing return statement after reflection creation.

**Step 3: Commit**

```bash
git add src/app/api/reflection/daily/route.ts
git commit -m "feat: integrate badge evaluation into reflection submission"
```

---

### Task 12: Integrate badge check into mentor message and adjust routes

**Files:**
- Modify: `src/app/api/mentor/message/route.ts`
- Modify: `src/app/api/mentor/adjust/route.ts`

**Step 12a: Mentor message route**

Add at top:
```typescript
import { buildBadgeContext, evaluateBadges, awardBadges } from "@/lib/badges";
```

After the mentor message is successfully saved (the return with the mentor response), add badge evaluation. Find the successful return block and add badge checking before it:

```typescript
    // Check for trailblazer badge (first mentor chat usage)
    const badgeCtx = await buildBadgeContext({
      childId: session.childId,
      questId: sessionId, // questId is available in the route scope
    });
    const newBadgeSlugs = evaluateBadges(badgeCtx);
    const newBadges = await awardBadges({
      childId: session.childId,
      newlyEarnedSlugs: newBadgeSlugs,
      trigger: "mentor_message",
      questId: sessionId, // pass questId from session
    });

    return NextResponse.json({
      role: "mentor",
      content: mentorResponse.content,
      suggestions: mentorResponse.suggestions,
      frustrationLevel: mentorResponse.frustrationLevel,
      offerAdjustment: mentorResponse.offerAdjustment,
      newBadges: newBadges.length > 0 ? newBadges : undefined,
    });
```

**Step 12b: Adjust route**

Add at top:
```typescript
import { buildBadgeContext, evaluateBadges, awardBadges } from "@/lib/badges";
```

After the adjustment is successfully saved, add badge evaluation before the return:

```typescript
    // Check for creativity badges (creative_adapter, persistent_explorer)
    const badgeCtx = await buildBadgeContext({
      childId: session.childId,
      questId: session.questId,
    });
    const newBadgeSlugs = evaluateBadges(badgeCtx);
    const newBadges = await awardBadges({
      childId: session.childId,
      newlyEarnedSlugs: newBadgeSlugs,
      trigger: "adjustment",
      questId: session.questId,
    });

    return NextResponse.json({
      success: true,
      adjustment: {
        id: adjustment.id,
        simplifiedInstructions: JSON.parse(adjustment.simplifiedInstructions),
      },
      newBadges: newBadges.length > 0 ? newBadges : undefined,
    });
```

**Step 3: Verify build**

Run: `bun run build`
Expected: Build succeeds.

**Step 4: Commit**

```bash
git add src/app/api/mentor/message/route.ts src/app/api/mentor/adjust/route.ts
git commit -m "feat: integrate badge evaluation into mentor message and adjust routes"
```

---

## Session 4: UI & i18n (Tasks 13–17)
Exit criteria: BadgeGrid component, BadgeToast notification, i18n in en/id/zh, integrated into quest page, build passes

### Task 13: Add i18n translations for badges (en, id, zh)

**Files:**
- Modify: `messages/en.json`
- Modify: `messages/id.json`
- Modify: `messages/zh.json`

**Step 1: Add badges key to each locale file**

Add a top-level `"badges"` key with all 8 badge name/description pairs plus UI strings.

For `messages/en.json`, add before the closing `}`:
```json
  "badges": {
    "title": "Your Badges",
    "subtitle": "Badges you've earned on your creative journey!",
    "empty": "No badges yet — keep exploring to earn your first one!",
    "earned": "Earned",
    "locked": "Locked",
    "categoryAll": "All",
    "categoryProgress": "Progress",
    "categoryCreativity": "Creativity",
    "categoryReflection": "Reflection",
    "categoryMentorship": "Mentorship",
    "newBadge": "New Badge Earned!",
    "close": "Close",
    "tierBronze": "Bronze",
    "tierSilver": "Silver",
    "tierGold": "Gold",
    "first_step": {
      "name": "First Step",
      "description": "You started your creative journey!"
    },
    "week_warrior": {
      "name": "Week Warrior",
      "description": "Completed all 7 days of a quest!"
    },
    "reflector": {
      "name": "Reflector",
      "description": "Took time to reflect on your learning"
    },
    "deep_thinker": {
      "name": "Deep Thinker",
      "description": "Reflected on 3 or more days in a quest"
    },
    "storyteller": {
      "name": "Storyteller",
      "description": "Shared a voice reflection"
    },
    "trailblazer": {
      "name": "Trailblazer",
      "description": "Asked the Quest Buddy for help"
    },
    "creative_adapter": {
      "name": "Creative Adapter",
      "description": "Found a new way to approach a challenge"
    },
    "persistent_explorer": {
      "name": "Persistent Explorer",
      "description": "Kept going even when it was tough"
    }
  }
```

For `messages/id.json`, add the same structure with Indonesian translations:

```json
  "badges": {
    "title": "Lencana Kamu",
    "subtitle": "Lencana yang kamu dapatkan dalam perjalanan kreatifmu!",
    "empty": "Belum ada lencana — terus eksplorasi untuk mendapatkan yang pertama!",
    "earned": "Didapat",
    "locked": "Terkunci",
    "categoryAll": "Semua",
    "categoryProgress": "Kemajuan",
    "categoryCreativity": "Kreativitas",
    "categoryReflection": "Refleksi",
    "categoryMentorship": "Bimbingan",
    "newBadge": "Lencana Baru!",
    "close": "Tutup",
    "tierBronze": "Perunggu",
    "tierSilver": "Perak",
    "tierGold": "Emas",
    "first_step": {
      "name": "Langkah Pertama",
      "description": "Kamu memulai perjalanan kreatifmu!"
    },
    "week_warrior": {
      "name": "Pejuang Minggu",
      "description": "Menyelesaikan semua 7 hari quest!"
    },
    "reflector": {
      "name": "Pemikir",
      "description": "Meluangkan waktu untuk merefleksikan pembelajaranmu"
    },
    "deep_thinker": {
      "name": "Pemikir Mendalam",
      "description": "Berefleksi pada 3 hari atau lebih dalam satu quest"
    },
    "storyteller": {
      "name": "Pencerita",
      "description": "Berbagi refleksi suara"
    },
    "trailblazer": {
      "name": "Pelopor",
      "description": "Bertanya pada Quest Buddy untuk bantuan"
    },
    "creative_adapter": {
      "name": "Penyesuaian Kreatif",
      "description": "Menemukan cara baru untuk menghadapi tantangan"
    },
    "persistent_explorer": {
      "name": "Penjelajah Tangguh",
      "description": "Terus maju meskipun sulit"
    }
  }
```

For `messages/zh.json`, add the same structure with Chinese translations:

```json
  "badges": {
    "title": "你的徽章",
    "subtitle": "你在创意旅程中获得的徽章！",
    "empty": "还没有徽章——继续探索来获得你的第一个！",
    "earned": "已获得",
    "locked": "未解锁",
    "categoryAll": "全部",
    "categoryProgress": "进步",
    "categoryCreativity": "创造力",
    "categoryReflection": "反思",
    "categoryMentorship": "指导",
    "newBadge": "获得新徽章！",
    "close": "关闭",
    "tierBronze": "铜",
    "tierSilver": "银",
    "tierGold": "金",
    "first_step": {
      "name": "第一步",
      "description": "你开始了你的创意之旅！"
    },
    "week_warrior": {
      "name": "一周勇士",
      "description": "完成了全部7天的任务！"
    },
    "reflector": {
      "name": "思考者",
      "description": "花时间反思你的学习"
    },
    "deep_thinker": {
      "name": "深度思考者",
      "description": "在一个任务中反思了3天或更多"
    },
    "storyteller": {
      "name": "故事家",
      "description": "分享了语音反思"
    },
    "trailblazer": {
      "name": "开拓者",
      "description": "向任务伙伴寻求帮助"
    },
    "creative_adapter": {
      "name": "创意改编者",
      "description": "找到了应对挑战的新方法"
    },
    "persistent_explorer": {
      "name": "坚韧探索者",
      "description": "即使困难也坚持前进"
    }
  }
```

**Step 2: Commit**

```bash
git add messages/en.json messages/id.json messages/zh.json
git commit -m "feat: add badge i18n translations (en, id, zh)"
```

---

### Task 14: Create BadgeToast component (new badge celebration)

**Files:**
- Create: `src/components/quest/BadgeToast.tsx`

**Step 1: Create the toast component**

A celebration overlay that appears when a new badge is earned. Shows the badge icon, name, and description with a brief animation.

```typescript
"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Sparkles, X } from "lucide-react";
import type { EarnedBadge } from "@/lib/badges";

interface BadgeToastProps {
  badges: EarnedBadge[];
  onClose: () => void;
}

export function BadgeToast({ badges, onClose }: BadgeToastProps) {
  const t = useTranslations("badges");
  const [currentIndex, setCurrentIndex] = useState(0);

  // Auto-advance through multiple badges
  useEffect(() => {
    if (badges.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentIndex((prev) => {
        if (prev >= badges.length - 1) {
          clearInterval(timer);
          return prev;
        }
        return prev + 1;
      });
    }, 3000);
    return () => clearInterval(timer);
  }, [badges.length]);

  // Auto-dismiss after 5 seconds for the last badge
  useEffect(() => {
    const timer = setTimeout(onClose, 5000);
    return () => clearTimeout(timer);
  }, [onClose]);

  if (badges.length === 0) return null;

  const badge = badges[currentIndex];
  const badgeT = useTranslations("badges");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      role="alert"
      aria-live="assertive"
    >
      <div className="relative mx-4 max-w-sm animate-[scale-in_0.3s_ease-out] rounded-2xl bg-white p-6 text-center shadow-2xl">
        <button
          onClick={onClose}
          className="absolute right-3 top-3 rounded-full p-1 text-muted-foreground hover:bg-muted"
          aria-label={t("close")}
        >
          <X className="size-4" />
        </button>

        <div className="mb-3 flex items-center justify-center gap-1 text-amber-500">
          <Sparkles className="size-5" aria-hidden="true" />
          <span className="text-sm font-semibold">{t("newBadge")}</span>
          <Sparkles className="size-5" aria-hidden="true" />
        </div>

        <div className="mb-3 text-5xl" aria-hidden="true">
          {badge.icon}
        </div>

        <h3 className="mb-1 text-lg font-bold text-foreground">
          {badgeT(`${badge.slug}.name`)}
        </h3>
        <p className="text-sm text-muted-foreground">
          {badgeT(`${badge.slug}.description`)}
        </p>

        {badges.length > 1 && (
          <p className="mt-3 text-xs text-muted-foreground">
            {currentIndex + 1} / {badges.length}
          </p>
        )}
      </div>
    </div>
  );
}
```

Note: The `animate-[scale-in_0.3s_ease-out]` uses Tailwind arbitrary animation. We'll add the keyframe in the component file or rely on a simple opacity+transform approach.

**Step 2: Commit**

```bash
git add src/components/quest/BadgeToast.tsx
git commit -m "feat: add BadgeToast celebration component"
```

---

### Task 15: Create BadgeGrid component

**Files:**
- Create: `src/components/quest/BadgeGrid.tsx`

**Step 1: Create the badge grid component**

```typescript
"use client";

import { useTranslations } from "next-intl";
import { useState, useEffect, useCallback } from "react";
import { Lock, Award } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { BadgeCategory } from "@/lib/badges";

interface BadgeData {
  slug: string;
  category: BadgeCategory;
  tier: string;
  icon: string;
  earned: boolean;
  earnedAt: string | null;
  questId: string | null;
}

interface BadgeGridProps {
  /** If provided, shows a compact view for this quest only */
  questId?: string;
}

const CATEGORY_FILTERS: Array<{ value: BadgeCategory | "all"; labelKey: string }> = [
  { value: "all", labelKey: "categoryAll" },
  { value: "progress", labelKey: "categoryProgress" },
  { value: "creativity", labelKey: "categoryCreativity" },
  { value: "reflection", labelKey: "categoryReflection" },
  { value: "mentorship", labelKey: "categoryMentorship" },
];

const TIER_COLORS: Record<string, string> = {
  bronze: "border-amber-300 bg-amber-50",
  silver: "border-gray-300 bg-gray-50",
  gold: "border-yellow-400 bg-yellow-50",
};

export function BadgeGrid({ questId }: BadgeGridProps) {
  const t = useTranslations("badges");
  const [badges, setBadges] = useState<BadgeData[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<BadgeCategory | "all">("all");

  const fetchBadges = useCallback(async () => {
    try {
      const res = await fetch("/api/badges");
      if (!res.ok) return;
      const data = await res.json();
      setBadges(data.badges ?? []);
    } catch {
      // Silently fail — badges are non-critical
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBadges();
  }, [fetchBadges]);

  const filtered =
    activeCategory === "all"
      ? badges
      : badges.filter((b) => b.category === activeCategory);

  const earnedCount = badges.filter((b) => b.earned).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Award className="size-6 animate-pulse text-muted-foreground" aria-hidden="true" />
      </div>
    );
  }

  return (
    <section aria-labelledby="badges-title">
      <div className="mb-4">
        <h2
          id="badges-title"
          className="flex items-center gap-2 text-lg font-bold text-foreground"
        >
          <Award className="size-5" aria-hidden="true" />
          {t("title")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("subtitle")} ({earnedCount}/{badges.length})
        </p>
      </div>

      {/* Category filters */}
      <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="Badge categories">
        {CATEGORY_FILTERS.map((filter) => (
          <Button
            key={filter.value}
            variant={activeCategory === filter.value ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveCategory(filter.value)}
            role="tab"
            aria-selected={activeCategory === filter.value}
          >
            {t(filter.labelKey)}
          </Button>
        ))}
      </div>

      {/* Badge grid */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-4 gap-3 sm:grid-cols-4 md:grid-cols-8">
          {filtered.map((badge) => (
            <BadgeCard key={badge.slug} badge={badge} />
          ))}
        </div>
      ) : (
        <p className="py-4 text-center text-sm italic text-muted-foreground">
          {t("empty")}
        </p>
      )}
    </section>
  );
}

function BadgeCard({ badge }: { badge: BadgeData }) {
  const t = useTranslations("badges");
  const tierColor = TIER_COLORS[badge.tier] ?? TIER_COLORS.bronze;

  return (
    <div
      className={`flex flex-col items-center gap-1 rounded-xl border p-3 text-center transition-opacity ${
        badge.earned ? tierColor : "border-border/40 bg-muted/30 opacity-50"
      }`}
      title={
        badge.earned
          ? `${t(`${badge.slug}.name`)} — ${t(`${badge.slug}.description`)}`
          : `${t("locked")}: ${t(`${badge.slug}.name`)}`
      }
    >
      <span className="text-2xl" aria-hidden="true">
        {badge.earned ? badge.icon : <Lock className="size-6 text-muted-foreground" />}
      </span>
      <span className="text-[10px] font-medium leading-tight text-foreground">
        {t(`${badge.slug}.name`)}
      </span>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/quest/BadgeGrid.tsx
git commit -m "feat: add BadgeGrid component with category filters"
```

---

### Task 16: Integrate BadgeGrid and BadgeToast into quest page

**Files:**
- Modify: `src/app/[locale]/quest/[id]/page.tsx`

**Step 1: Add BadgeGrid import and render**

Import the BadgeGrid component and render it in the quest overview page. The BadgeGrid should appear below the quest header and above the timeline.

Read the current quest page to find the right insertion point, then add:
```typescript
import { BadgeGrid } from "@/components/quest/BadgeGrid";
```

And render `<BadgeGrid questId={questId} />` in the appropriate section.

**Step 2: Add BadgeToast handling**

The quest page needs to handle `newBadges` in mission complete and reflection responses. This requires state management for showing the toast when badges are earned.

Add state and handler:
```typescript
const [earnedBadges, setEarnedBadges] = useState<EarnedBadge[]>([]);
```

When mission status changes or reflection is submitted, check for `newBadges` in the response and set state.

Import BadgeToast:
```typescript
import { BadgeToast } from "@/components/quest/BadgeToast";
import type { EarnedBadge } from "@/lib/badges";
```

Render:
```typescript
{earnedBadges.length > 0 && (
  <BadgeToast badges={earnedBadges} onClose={() => setEarnedBadges([])} />
)}
```

The exact integration depends on the current page structure — the implementer should read the page first and find the right spots.

**Step 3: Commit**

```bash
git add src/app/[locale]/quest/[id]/page.tsx
git commit -m "feat: integrate BadgeGrid and BadgeToast into quest page"
```

---

### Task 17: Final build verification and commit

**Step 1: Run full build**

Run: `bun run build`
Expected: Build succeeds with no errors.

**Step 2: Run database migration (if not already applied)**

Run: `bunx prisma migrate dev`
Expected: All migrations applied.

**Step 3: Verify seed**

Run: `bunx prisma db seed`
Expected: Seed completes without error (ChildBadge table is cleaned).

**Step 4: Final commit if any fixes needed**

If any fixes were required during verification:
```bash
git add -A
git commit -m "fix: resolve build issues from badge integration"
```

---

## Summary

| Session | Tasks | Files Created | Files Modified |
|---------|-------|---------------|----------------|
| 1: Data Layer | 1–4 | `src/lib/badges/schemas.ts`, `src/lib/badges/definitions.ts` | `prisma/schema.prisma`, `prisma/seed.ts` |
| 2: Badge Engine | 5–6 | `src/lib/badges/engine.ts`, `src/lib/badges/index.ts` | — |
| 3: API + Integration | 7–12 | `src/lib/badges/build-context.ts`, `src/lib/badges/award.ts`, `src/app/api/badges/route.ts` | `mission route`, `reflection route`, `mentor message route`, `adjust route` |
| 4: UI + i18n | 13–17 | `src/components/quest/BadgeToast.tsx`, `src/components/quest/BadgeGrid.tsx` | `messages/en.json`, `messages/id.json`, `messages/zh.json`, `quest page` |

**8 badges across 4 categories:**
- **Progress**: First Step (bronze), Week Warrior (gold)
- **Creativity**: Creative Adapter (silver), Persistent Explorer (gold)
- **Reflection**: Reflector (bronze), Deep Thinker (silver), Storyteller (silver)
- **Mentorship**: Trailblazer (bronze)
