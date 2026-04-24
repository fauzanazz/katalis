# Squad Gallery 2.0 — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use parallel-plan-execution to implement this plan task-by-task.

**Goal:** Enable explicit Squad membership UX where children can join/leave squads, with normalized talent tags for better filtering/discovery.

**Current State:**
- `Squad` + `SquadMember` models exist in Prisma
- `GalleryEntry.talentTags` stores multi-tags as JSON text
- `SquadBrowseView` component shows squads but no join action
- Clustering AI runs but never persists results

**Architecture:** Add Squad join/leave API endpoints. Add `squadId` to GalleryEntry for proper relations. Create browsable tag taxonomy. Wire clustering output to Squad creation.

**Tech Stack:** Prisma, Zod, Next.js API routes, shadcn Button/Dialog, lucide-react, next-intl

---

## Session 1: Squad Membership API (Tasks 1-4)

Exit criteria: Child can join/leave squads via API, build passes

### Task 1: Create Squad Join/Leave API Route

**Files:**
- Create: `src/app/api/squads/[id]/membership/route.ts`

**Step 1: Create the membership route**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getChildSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * POST /api/squads/[id]/membership — Join a squad
 * DELETE /api/squads/[id]/membership — Leave a squad
 */

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getChildSession();
  if (!session) {
    return NextResponse.json(
      { error: "unauthorized", message: "Authentication required" },
      { status: 401 },
    );
  }

  try {
    const { id: squadId } = await params;

    const squad = await prisma.squad.findUnique({ where: { id: squadId } });
    if (!squad || squad.status !== "active") {
      return NextResponse.json(
        { error: "not_found", message: "Squad not found or inactive" },
        { status: 404 },
      );
    }

    // Check existing membership
    const existing = await prisma.squadMember.findUnique({
      where: {
        squadId_childId: { squadId, childId: session.childId },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: "already_member", message: "Already a member of this squad" },
        { status: 400 },
      );
    }

    await prisma.squadMember.create({
      data: { squadId, childId: session.childId },
    });

    return NextResponse.json({ success: true, joined: true });
  } catch (error) {
    console.error("Squad join error:", error);
    return NextResponse.json(
      { error: "server_error", message: "Failed to join squad" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getChildSession();
  if (!session) {
    return NextResponse.json(
      { error: "unauthorized", message: "Authentication required" },
      { status: 401 },
    );
  }

  try {
    const { id: squadId } = await params;

    const membership = await prisma.squadMember.findUnique({
      where: {
        squadId_childId: { squadId, childId: session.childId },
      },
    });

    if (!membership) {
      return NextResponse.json(
        { error: "not_member", message: "Not a member of this squad" },
        { status: 400 },
      );
    }

    await prisma.squadMember.delete({
      where: { id: membership.id },
    });

    return NextResponse.json({ success: true, left: true });
  } catch (error) {
    console.error("Squad leave error:", error);
    return NextResponse.json(
      { error: "server_error", message: "Failed to leave squad" },
      { status: 500 },
    );
  }
}
```

**Step 2: Verify build**

Run: `bun run build`

**Step 3: Commit**

```bash
git add src/app/api/squads/
git commit -m "feat: add squad join/leave membership API"
```

---

### Task 2: Create GET /api/squads/my-squads Route

**Files:**
- Create: `src/app/api/squads/my-squads/route.ts`

**Step 1: Create the route**

```typescript
import { NextResponse } from "next/server";
import { getChildSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * GET /api/squads/my-squads — Get squads the child has joined
 */
export async function GET() {
  const session = await getChildSession();
  if (!session) {
    return NextResponse.json(
      { error: "unauthorized", message: "Authentication required" },
      { status: 401 },
    );
  }

  try {
    const memberships = await prisma.squadMember.findMany({
      where: { childId: session.childId },
      include: {
        squad: {
          select: {
            id: true,
            name: true,
            theme: true,
            icon: true,
            description: true,
            _count: { select: { members: true } },
          },
        },
      },
    });

    const squads = memberships.map((m) => ({
      id: m.squad.id,
      name: m.squad.name,
      theme: m.squad.theme,
      icon: m.squad.icon,
      description: m.squad.description,
      memberCount: m.squad._count.members,
      joinedAt: m.createdAt.toISOString(),
    }));

    return NextResponse.json({ squads });
  } catch (error) {
    console.error("My squads fetch error:", error);
    return NextResponse.json(
      { error: "server_error", message: "Failed to fetch squads" },
      { status: 500 },
    );
  }
}
```

**Step 2: Commit**

```bash
git add src/app/api/squads/my-squads/route.ts
git commit -m "feat: add GET /api/squads/my-squads route"
```

---

### Task 3: Add i18n Translations for Squad Membership

**Files:**
- Modify: `messages/en.json`
- Modify: `messages/id.json`
- Modify: `messages/zh.json`

**Step 1: Add squad membership translations**

In each locale file, add to or create a `"squads"` key:

**en.json:**
```json
"squads": {
  "join": "Join Squad",
  "leave": "Leave Squad",
  "joined": "Joined!",
  "left": "Left squad",
  "memberCount": "{count} members",
  "mySquads": "My Squads",
  "noSquads": "You haven't joined any squads yet",
  "exploreSquads": "Explore Squads",
  "confirmLeave": "Leave this squad?",
  "confirmLeaveDesc": "You can always rejoin later.",
  "cancel": "Cancel"
}
```

**id.json:**
```json
"squads": {
  "join": "Gabung Squad",
  "leave": "Keluar Squad",
  "joined": "Bergabung!",
  "left": "Keluar dari squad",
  "memberCount": "{count} anggota",
  "mySquads": "Squad Saya",
  "noSquads": "Kamu belum bergabung dengan squad manapun",
  "exploreSquads": "Jelajahi Squad",
  "confirmLeave": "Keluar dari squad ini?",
  "confirmLeaveDesc": "Kamu bisa bergabung lagi kapan saja.",
  "cancel": "Batal"
}
```

**zh.json:**
```json
"squads": {
  "join": "加入小队",
  "leave": "离开小队",
  "joined": "已加入！",
  "left": "已离开小队",
  "memberCount": "{count} 名成员",
  "mySquads": "我的小队",
  "noSquads": "你还没有加入任何小队",
  "exploreSquads": "探索小队",
  "confirmLeave": "离开这个小队？",
  "confirmLeaveDesc": "你可以随时重新加入。",
  "cancel": "取消"
}
```

**Step 2: Commit**

```bash
git add messages/
git commit -m "feat: add squad membership i18n (en/id/zh)"
```

---

### Task 4: Add JoinSquadButton Component

**Files:**
- Create: `src/components/gallery/JoinSquadButton.tsx`

**Step 1: Create the component**

```typescript
"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { UserPlus, UserMinus, Loader2 } from "lucide-react";

interface JoinSquadButtonProps {
  squadId: string;
  isMember: boolean;
  onMembershipChange?: (isMember: boolean) => void;
}

export function JoinSquadButton({
  squadId,
  isMember: initialIsMember,
  onMembershipChange,
}: JoinSquadButtonProps) {
  const t = useTranslations("squads");
  const router = useRouter();
  const [isMember, setIsMember] = useState(initialIsMember);
  const [loading, setLoading] = useState(false);

  async function handleToggle() {
    setLoading(true);
    try {
      const method = isMember ? "DELETE" : "POST";
      const res = await fetch(`/api/squads/${squadId}/membership`, { method });

      if (res.ok) {
        const newState = !isMember;
        setIsMember(newState);
        onMembershipChange?.(newState);
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      variant={isMember ? "outline" : "default"}
      size="sm"
      onClick={handleToggle}
      disabled={loading}
      className="gap-1.5"
    >
      {loading ? (
        <Loader2 className="size-4 animate-spin" />
      ) : isMember ? (
        <UserMinus className="size-4" />
      ) : (
        <UserPlus className="size-4" />
      )}
      {isMember ? t("leave") : t("join")}
    </Button>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/gallery/JoinSquadButton.tsx
git commit -m "feat: add JoinSquadButton component"
```

---

## Session 2: Integrate Join Button into Squad UI (Tasks 5-7)

Exit criteria: SquadBrowseView shows join/leave button, child membership state visible

### Task 5: Update Squad Queries to Include Membership Status

**Files:**
- Modify: `src/lib/squads/queries.ts`

**Step 1: Add getSquadWithMembership function**

Add this function to the queries file:

```typescript
export async function getSquadWithMembership(
  squadId: string,
  childId: string | null,
): Promise<{
  squad: Squad & { memberCount: number };
  isMember: boolean;
} | null> {
  const squad = await prisma.squad.findUnique({
    where: { id: squadId },
    include: {
      _count: { select: { members: true } },
    },
  });

  if (!squad) return null;

  let isMember = false;
  if (childId) {
    const membership = await prisma.squadMember.findUnique({
      where: { squadId_childId: { squadId, childId } },
    });
    isMember = !!membership;
  }

  return {
    squad: { ...squad, memberCount: squad._count.members },
    isMember,
  };
}

export async function getAllSquadsWithMembership(
  childId: string | null,
): Promise<Array<Squad & { memberCount: number; isMember: boolean }>> {
  const squads = await prisma.squad.findMany({
    where: { status: "active" },
    include: {
      _count: { select: { members: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!childId) {
    return squads.map((s) => ({
      ...s,
      memberCount: s._count.members,
      isMember: false,
    }));
  }

  const memberships = await prisma.squadMember.findMany({
    where: { childId },
    select: { squadId: true },
  });
  const memberSquadIds = new Set(memberships.map((m) => m.squadId));

  return squads.map((s) => ({
    ...s,
    memberCount: s._count.members,
    isMember: memberSquadIds.has(s.id),
  }));
}
```

**Step 2: Commit**

```bash
git add src/lib/squads/queries.ts
git commit -m "feat: add squad queries with membership status"
```

---

### Task 6: Update SquadBrowseView to Show Join Button

**Files:**
- Modify: `src/components/gallery/SquadBrowseView.tsx`

**Step 1: Import JoinSquadButton and add to squad cards**

Add import:
```typescript
import { JoinSquadButton } from "./JoinSquadButton";
```

In the squad card render section, add the JoinSquadButton after the squad info. The exact location depends on the current component structure, but typically:

```typescript
<JoinSquadButton squadId={squad.id} isMember={squad.isMember} />
```

**Step 2: Update data fetching to use getAllSquadsWithMembership**

Modify the component or its parent page to pass `isMember` status to each squad card.

**Step 3: Commit**

```bash
git add src/components/gallery/SquadBrowseView.tsx
git commit -m "feat: integrate JoinSquadButton into SquadBrowseView"
```

---

### Task 7: Add "My Squads" Section to Gallery Page

**Files:**
- Modify: `src/app/[locale]/gallery/page.tsx`

**Step 1: Fetch child's squads and display above browse view**

Add a "My Squads" section that shows the squads the child has joined, with quick links to view them.

```typescript
// In the page component, fetch my squads
const mySquads = session?.childId 
  ? await prisma.squadMember.findMany({
      where: { childId: session.childId },
      include: { squad: true },
      take: 5,
    })
  : [];
```

Render:
```typescript
{mySquads.length > 0 && (
  <section className="mb-6">
    <h2 className="mb-3 text-lg font-semibold">{t("squads.mySquads")}</h2>
    <div className="flex gap-2 overflow-x-auto pb-2">
      {mySquads.map((m) => (
        <SquadChip key={m.squadId} squad={m.squad} />
      ))}
    </div>
  </section>
)}
```

**Step 2: Commit**

```bash
git add src/app/[locale]/gallery/page.tsx
git commit -m "feat: add My Squads section to gallery page"
```

---

## Session 3: Normalize Talent Tags (Tasks 8-10)

Exit criteria: Tag model in Prisma, entries linked to tags, tag filter in gallery

### Task 8: Add Tag Model and Entry-Tag Relation

**Files:**
- Modify: `prisma/schema.prisma`

**Step 1: Add Tag model and GalleryEntryTag join table**

```prisma
model Tag {
  id          String            @id @default(cuid())
  slug        String            @unique
  category    String            // "talent", "material", "theme"
  displayName String?           // Optional override for display
  icon        String?           // Emoji or icon identifier
  createdAt   DateTime          @default(now())
  entries     GalleryEntryTag[]

  @@index([category])
}

model GalleryEntryTag {
  id         String       @id @default(cuid())
  entryId    String
  tagSlug    String
  confidence Float?       // AI confidence for this tag
  entry      GalleryEntry @relation(fields: [entryId], references: [id], onDelete: Cascade)

  @@unique([entryId, tagSlug])
  @@index([tagSlug])
}
```

**Step 2: Add relation to GalleryEntry**

Add to GalleryEntry model:
```prisma
tags GalleryEntryTag[]
```

**Step 3: Run migration**

```bash
bunx prisma migrate dev --name add_tag_system
bunx prisma generate
```

**Step 4: Commit**

```bash
git add prisma/
git commit -m "feat: add Tag model and GalleryEntryTag relation"
```

---

### Task 9: Create Tag Seeding Script

**Files:**
- Create: `src/lib/tags/seed-tags.ts`
- Modify: `prisma/seed.ts`

**Step 1: Create initial tag definitions**

```typescript
import { prisma } from "@/lib/db";

const TALENT_TAGS = [
  { slug: "engineering", icon: "🔧", category: "talent" },
  { slug: "visual-art", icon: "🎨", category: "talent" },
  { slug: "music", icon: "🎵", category: "talent" },
  { slug: "narrative", icon: "📖", category: "talent" },
  { slug: "science", icon: "🔬", category: "talent" },
  { slug: "physical", icon: "⚽", category: "talent" },
  { slug: "social", icon: "🤝", category: "talent" },
  { slug: "nature", icon: "🌿", category: "talent" },
  { slug: "logic", icon: "🧩", category: "talent" },
  { slug: "creative", icon: "✨", category: "talent" },
] as const;

export async function seedTags() {
  for (const tag of TALENT_TAGS) {
    await prisma.tag.upsert({
      where: { slug: tag.slug },
      update: { icon: tag.icon },
      create: tag,
    });
  }
  console.log(`Seeded ${TALENT_TAGS.length} tags`);
}
```

**Step 2: Add to seed.ts**

Import and call `seedTags()` in the main seed function.

**Step 3: Commit**

```bash
git add src/lib/tags/ prisma/seed.ts
git commit -m "feat: add tag seeding with 10 talent categories"
```

---

### Task 10: Add Tag Filter to Gallery API

**Files:**
- Modify: `src/app/api/gallery/entries/route.ts`

**Step 1: Add tag query parameter**

In the GET handler, add tag filtering:

```typescript
const tagFilter = url.searchParams.get("tag");

// In the where clause:
const where = {
  ...(tagFilter && {
    tags: {
      some: { tagSlug: tagFilter },
    },
  }),
};
```

**Step 2: Include tags in response**

```typescript
include: {
  tags: {
    select: { tagSlug: true, confidence: true },
  },
}
```

**Step 3: Commit**

```bash
git add src/app/api/gallery/entries/route.ts
git commit -m "feat: add tag filter to gallery entries API"
```

---

## Session 4: Final Integration (Tasks 11-12)

### Task 11: Add Tag Filter UI to Gallery

**Files:**
- Create: `src/components/gallery/TagFilter.tsx`
- Modify: `src/app/[locale]/gallery/page.tsx`

Create a horizontal pill-based filter that shows available tags and allows filtering.

### Task 12: Final Build Verification

Run: `bun run build && bunx prisma db seed`

---

## Summary

| Session | Tasks | What's Built |
|---------|-------|--------------|
| 1 | 1-4 | Squad join/leave API, my-squads endpoint, JoinSquadButton |
| 2 | 5-7 | Membership queries, SquadBrowseView integration, My Squads section |
| 3 | 8-10 | Tag model, seed tags, tag filter API |
| 4 | 11-12 | Tag filter UI, final verification |

**New API routes:**
- `POST/DELETE /api/squads/[id]/membership`
- `GET /api/squads/my-squads`

**New Prisma models:**
- `Tag`
- `GalleryEntryTag`

**New UI components:**
- `JoinSquadButton`
- `TagFilter`
