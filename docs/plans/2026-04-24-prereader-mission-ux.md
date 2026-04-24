# Pre-reader Mission UX — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use parallel-plan-execution to implement this plan task-by-task.

**Goal:** Make mission briefings accessible to pre-reader children (ages 4-6) with icon-first instructions, large tap targets, optional TTS read-aloud, and the ability to display simplified instructions from AdjustmentEvent.

**Current State:**
- `MissionDetail.tsx` renders text-only instructions as numbered list
- `AdjustmentEvent.simplifiedInstructions` exists in DB but never surfaces in UI
- No icon field on Mission model
- No TTS/audio playback
- Standard font sizes for prose

**Architecture:** Extend AI quest generation to output `{ icon, text }` instruction format. Add icon rendering to MissionDetail. Create "read aloud" button using Web Speech API. Surface simplified instructions when available. Add accessibility mode toggle in child settings.

**Tech Stack:** Next.js, Prisma, shadcn Button, lucide-react, Web Speech API (browser TTS), next-intl

---

## Session 1: Instruction Icon Schema (Tasks 1-3)

Exit criteria: AI generates icon-enriched instructions, Mission stores them, build passes

### Task 1: Update Quest Generation Prompt for Icons

**Files:**
- Modify: `src/lib/ai/quest/generate-quest.ts`

**Step 1: Update the AI prompt to request icon-enriched instructions**

Find the system prompt that generates missions. Update it to request this format:

```typescript
const MISSION_FORMAT = `
For each mission, provide instructions as an array of objects:
{
  "instructions": [
    { "icon": "🎨", "text": "Draw a picture of your dream" },
    { "icon": "✂️", "text": "Cut out the shapes" },
    { "icon": "📸", "text": "Take a photo of your work" }
  ]
}

Use simple, universal emoji icons that a young child can understand:
- 🎨 for drawing/coloring
- ✂️ for cutting
- 📸 for taking photos
- 🔍 for looking/observing
- 🏃 for physical movement
- 💬 for talking/asking
- 📝 for writing
- 🎵 for music/sounds
- 🌳 for nature/outdoors
- 🤲 for building/making
- 🧹 for cleaning up
`;
```

**Step 2: Update the response parser**

Ensure the response parser handles the new format and falls back gracefully for plain string arrays.

**Step 3: Commit**

```bash
git add src/lib/ai/quest/generate-quest.ts
git commit -m "feat: update quest generation to output icon-enriched instructions"
```

---

### Task 2: Create Instruction Type and Parser

**Files:**
- Create: `src/lib/quest/instruction-types.ts`

**Step 1: Create type definitions and parser**

```typescript
import { z } from "zod";

/** Single instruction with optional icon */
export const InstructionSchema = z.union([
  z.object({
    icon: z.string().optional(),
    text: z.string(),
  }),
  z.string().transform((text) => ({ text, icon: undefined })),
]);

export type Instruction = z.infer<typeof InstructionSchema>;

/** Array of instructions (handles both old and new format) */
export const InstructionsSchema = z.array(InstructionSchema);

/**
 * Parse instructions from JSON string.
 * Handles both legacy string[] and new { icon, text }[] formats.
 */
export function parseInstructions(json: string | null): Instruction[] {
  if (!json) return [];

  try {
    const parsed = JSON.parse(json);
    const result = InstructionsSchema.safeParse(parsed);
    
    if (result.success) {
      return result.data;
    }
    
    // Fallback: treat as string array
    if (Array.isArray(parsed)) {
      return parsed.map((text) => ({
        text: String(text),
        icon: undefined,
      }));
    }
    
    return [];
  } catch {
    return [];
  }
}

/** Default icons for common instruction patterns */
const INSTRUCTION_ICON_PATTERNS: Array<{ pattern: RegExp; icon: string }> = [
  { pattern: /draw|color|paint|sketch/i, icon: "🎨" },
  { pattern: /cut|scissors/i, icon: "✂️" },
  { pattern: /photo|picture|capture/i, icon: "📸" },
  { pattern: /look|observe|find|search/i, icon: "🔍" },
  { pattern: /run|jump|move|walk|go outside/i, icon: "🏃" },
  { pattern: /ask|tell|talk|share|discuss/i, icon: "💬" },
  { pattern: /write|list|note/i, icon: "📝" },
  { pattern: /sing|music|sound|listen/i, icon: "🎵" },
  { pattern: /nature|plant|tree|garden|outside/i, icon: "🌳" },
  { pattern: /build|make|create|construct/i, icon: "🤲" },
  { pattern: /clean|tidy|put away/i, icon: "🧹" },
  { pattern: /think|imagine|dream/i, icon: "💭" },
  { pattern: /measure|count|number/i, icon: "📏" },
  { pattern: /mix|combine|pour/i, icon: "🥣" },
];

/**
 * Infer an icon from instruction text if none provided.
 */
export function inferInstructionIcon(text: string): string {
  for (const { pattern, icon } of INSTRUCTION_ICON_PATTERNS) {
    if (pattern.test(text)) {
      return icon;
    }
  }
  return "▶️"; // Default play/action icon
}

/**
 * Ensure all instructions have icons (infer if missing).
 */
export function enrichInstructionsWithIcons(
  instructions: Instruction[],
): Array<{ icon: string; text: string }> {
  return instructions.map((inst) => ({
    icon: inst.icon ?? inferInstructionIcon(inst.text),
    text: inst.text,
  }));
}
```

**Step 2: Commit**

```bash
git add src/lib/quest/instruction-types.ts
git commit -m "feat: add instruction type with icon inference"
```

---

### Task 3: Update MissionDetail to Render Icons

**Files:**
- Modify: `src/components/quest/MissionDetail.tsx`

**Step 1: Import instruction parser**

```typescript
import {
  parseInstructions,
  enrichInstructionsWithIcons,
} from "@/lib/quest/instruction-types";
```

**Step 2: Update instructions rendering**

Replace the text-only numbered list with icon-first rendering:

```typescript
// Parse and enrich instructions
const instructions = enrichInstructionsWithIcons(
  parseInstructions(mission.instructions),
);

// In the render:
<ol className="space-y-3">
  {instructions.map((instruction, index) => (
    <li
      key={index}
      className="flex items-start gap-3 rounded-lg bg-muted/50 p-3"
    >
      <span
        className="flex size-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-xl"
        aria-hidden="true"
      >
        {instruction.icon}
      </span>
      <div className="flex-1">
        <span className="text-xs font-medium text-muted-foreground">
          {t("step")} {index + 1}
        </span>
        <p className="text-sm font-medium text-foreground">
          {instruction.text}
        </p>
      </div>
    </li>
  ))}
</ol>
```

**Step 3: Commit**

```bash
git add src/components/quest/MissionDetail.tsx
git commit -m "feat: render icon-enriched instructions in MissionDetail"
```

---

## Session 2: Read Aloud Feature (Tasks 4-6)

Exit criteria: Child can tap to hear instructions read aloud, TTS works on mobile

### Task 4: Create Read Aloud Hook

**Files:**
- Create: `src/hooks/use-read-aloud.ts`

**Step 1: Create the TTS hook**

```typescript
"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface UseReadAloudOptions {
  lang?: string;
  rate?: number;
  pitch?: number;
}

export function useReadAloud(options: UseReadAloudOptions = {}) {
  const { lang = "en-US", rate = 0.9, pitch = 1.1 } = options;
  const [isReading, setIsReading] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    setIsSupported(typeof window !== "undefined" && "speechSynthesis" in window);
  }, []);

  const speak = useCallback(
    (text: string) => {
      if (!isSupported) return;

      // Cancel any ongoing speech
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang;
      utterance.rate = rate;
      utterance.pitch = pitch;

      utterance.onstart = () => setIsReading(true);
      utterance.onend = () => setIsReading(false);
      utterance.onerror = () => setIsReading(false);

      utteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    },
    [isSupported, lang, rate, pitch],
  );

  const stop = useCallback(() => {
    if (!isSupported) return;
    window.speechSynthesis.cancel();
    setIsReading(false);
  }, [isSupported]);

  const speakInstructions = useCallback(
    (instructions: Array<{ text: string }>) => {
      if (!isSupported || instructions.length === 0) return;

      const fullText = instructions
        .map((inst, i) => `Step ${i + 1}: ${inst.text}`)
        .join(". ");

      speak(fullText);
    },
    [isSupported, speak],
  );

  return {
    isSupported,
    isReading,
    speak,
    speakInstructions,
    stop,
  };
}
```

**Step 2: Commit**

```bash
git add src/hooks/use-read-aloud.ts
git commit -m "feat: add useReadAloud hook for TTS"
```

---

### Task 5: Add Read Aloud Button to MissionDetail

**Files:**
- Modify: `src/components/quest/MissionDetail.tsx`

**Step 1: Import and use the hook**

```typescript
import { useReadAloud } from "@/hooks/use-read-aloud";
import { Volume2, VolumeX } from "lucide-react";
```

**Step 2: Add the read aloud button**

```typescript
// In the component
const { isSupported, isReading, speakInstructions, stop } = useReadAloud({
  lang: locale === "id" ? "id-ID" : locale === "zh" ? "zh-CN" : "en-US",
});

// In the render, add near the instructions header:
{isSupported && (
  <Button
    variant="ghost"
    size="sm"
    onClick={() =>
      isReading ? stop() : speakInstructions(instructions)
    }
    className="gap-1.5"
    aria-label={isReading ? t("stopReading") : t("readAloud")}
  >
    {isReading ? (
      <>
        <VolumeX className="size-4" />
        {t("stop")}
      </>
    ) : (
      <>
        <Volume2 className="size-4" />
        {t("readAloud")}
      </>
    )}
  </Button>
)}
```

**Step 3: Commit**

```bash
git add src/components/quest/MissionDetail.tsx
git commit -m "feat: add read aloud button to mission instructions"
```

---

### Task 6: Add Read Aloud i18n

**Files:**
- Modify: `messages/en.json`, `messages/id.json`, `messages/zh.json`

**Step 1: Add translations**

In `quest` section:

**en.json:**
```json
"readAloud": "Read Aloud",
"stopReading": "Stop Reading",
"stop": "Stop",
"step": "Step"
```

**id.json:**
```json
"readAloud": "Baca Keras",
"stopReading": "Berhenti Membaca",
"stop": "Berhenti",
"step": "Langkah"
```

**zh.json:**
```json
"readAloud": "朗读",
"stopReading": "停止朗读",
"stop": "停止",
"step": "步骤"
```

**Step 2: Commit**

```bash
git add messages/
git commit -m "feat: add read aloud i18n (en/id/zh)"
```

---

## Session 3: Simplified Instructions (Tasks 7-9)

Exit criteria: When simplified instructions exist, they display instead of original

### Task 7: Create Simplified Instructions Fetcher

**Files:**
- Create: `src/lib/quest/get-simplified-instructions.ts`

**Step 1: Create the fetcher**

```typescript
import { prisma } from "@/lib/db";
import { parseInstructions, type Instruction } from "./instruction-types";

/**
 * Get the most recent simplified instructions for a mission, if any.
 * Falls back to the original mission instructions.
 */
export async function getSimplifiedInstructions(
  missionId: string,
): Promise<{
  instructions: Instruction[];
  isSimplified: boolean;
}> {
  // Find most recent adjustment for this mission's session
  const mission = await prisma.mission.findUnique({
    where: { id: missionId },
    select: {
      instructions: true,
      quest: {
        select: {
          mentorSession: {
            select: {
              adjustments: {
                orderBy: { createdAt: "desc" },
                take: 1,
                select: { simplifiedInstructions: true },
              },
            },
          },
        },
      },
    },
  });

  if (!mission) {
    return { instructions: [], isSimplified: false };
  }

  const latestAdjustment = mission.quest?.mentorSession?.adjustments[0];

  if (latestAdjustment?.simplifiedInstructions) {
    return {
      instructions: parseInstructions(latestAdjustment.simplifiedInstructions),
      isSimplified: true,
    };
  }

  return {
    instructions: parseInstructions(mission.instructions),
    isSimplified: false,
  };
}
```

**Step 2: Commit**

```bash
git add src/lib/quest/get-simplified-instructions.ts
git commit -m "feat: add simplified instructions fetcher"
```

---

### Task 8: Update MissionDetail to Show Simplified Instructions

**Files:**
- Modify: `src/components/quest/MissionDetail.tsx`

**Step 1: Accept simplified instructions prop**

Add prop:
```typescript
interface MissionDetailProps {
  mission: Mission;
  simplifiedInstructions?: Instruction[];
  isSimplified?: boolean;
}
```

**Step 2: Use simplified when available**

```typescript
const instructions = enrichInstructionsWithIcons(
  props.simplifiedInstructions ?? parseInstructions(mission.instructions),
);
```

**Step 3: Show simplified indicator**

```typescript
{isSimplified && (
  <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
    <Sparkles className="size-3" />
    {t("simplified")}
  </span>
)}
```

**Step 4: Commit**

```bash
git add src/components/quest/MissionDetail.tsx
git commit -m "feat: display simplified instructions when available"
```

---

### Task 9: Wire Simplified Instructions in Quest Page

**Files:**
- Modify: `src/app/[locale]/quest/[id]/page.tsx`

**Step 1: Fetch simplified instructions for current mission**

```typescript
import { getSimplifiedInstructions } from "@/lib/quest/get-simplified-instructions";

// In the page component, after fetching the quest:
const currentMission = quest.missions.find(
  (m) => m.status === "in_progress" || m.status === "available",
);

let simplifiedData = { instructions: [], isSimplified: false };
if (currentMission) {
  simplifiedData = await getSimplifiedInstructions(currentMission.id);
}
```

**Step 2: Pass to MissionDetail**

```typescript
<MissionDetail
  mission={currentMission}
  simplifiedInstructions={simplifiedData.isSimplified ? simplifiedData.instructions : undefined}
  isSimplified={simplifiedData.isSimplified}
/>
```

**Step 3: Commit**

```bash
git add src/app/[locale]/quest/[id]/page.tsx
git commit -m "feat: wire simplified instructions to quest page"
```

---

## Session 4: Accessibility Mode & Polish (Tasks 10-12)

Exit criteria: Child can toggle accessibility mode, larger fonts, final polish

### Task 10: Add Accessibility Mode to Child Settings

**Files:**
- Modify: `prisma/schema.prisma` (add accessibilityMode field)
- Modify: `src/app/api/child/settings/route.ts`

**Step 1: Add field to Child model**

```prisma
// In Child model:
accessibilityMode Boolean @default(false)
```

**Step 2: Run migration**

```bash
bunx prisma migrate dev --name add_accessibility_mode
```

**Step 3: Update settings API to handle accessibilityMode**

**Step 4: Commit**

```bash
git add prisma/ src/app/api/child/settings/route.ts
git commit -m "feat: add accessibilityMode to child settings"
```

---

### Task 11: Apply Accessibility Mode Styles

**Files:**
- Modify: `src/components/quest/MissionDetail.tsx`

**Step 1: Accept accessibilityMode prop and apply larger styles**

```typescript
interface MissionDetailProps {
  mission: Mission;
  simplifiedInstructions?: Instruction[];
  isSimplified?: boolean;
  accessibilityMode?: boolean;
}

// Apply conditional classes:
const textSize = accessibilityMode ? "text-lg" : "text-sm";
const iconSize = accessibilityMode ? "size-14 text-3xl" : "size-10 text-xl";
const padding = accessibilityMode ? "p-4" : "p-3";
```

**Step 2: Update instruction list**

```typescript
<ol className={`space-y-${accessibilityMode ? "4" : "3"}`}>
  {instructions.map((instruction, index) => (
    <li
      key={index}
      className={`flex items-start gap-${accessibilityMode ? "4" : "3"} rounded-lg bg-muted/50 ${padding}`}
    >
      <span
        className={`flex shrink-0 items-center justify-center rounded-full bg-amber-100 ${iconSize}`}
        aria-hidden="true"
      >
        {instruction.icon}
      </span>
      <div className="flex-1">
        <span className={`font-medium text-muted-foreground ${accessibilityMode ? "text-base" : "text-xs"}`}>
          {t("step")} {index + 1}
        </span>
        <p className={`font-medium text-foreground ${textSize}`}>
          {instruction.text}
        </p>
      </div>
    </li>
  ))}
</ol>
```

**Step 3: Commit**

```bash
git add src/components/quest/MissionDetail.tsx
git commit -m "feat: apply accessibility mode styles to mission instructions"
```

---

### Task 12: Final Build Verification

Run: `bun run build && bunx prisma migrate dev`

Verify:
- Instructions render with icons
- Read aloud button works
- Simplified instructions display when available
- Accessibility mode enlarges text/icons

---

## Summary

| Session | Tasks | What's Built |
|---------|-------|--------------|
| 1 | 1-3 | Icon-enriched instruction schema, parser, icon rendering |
| 2 | 4-6 | TTS read aloud hook, button, i18n |
| 3 | 7-9 | Simplified instructions fetcher, display, wiring |
| 4 | 10-12 | Accessibility mode field, larger styles, verification |

**New files:**
- `src/lib/quest/instruction-types.ts`
- `src/hooks/use-read-aloud.ts`
- `src/lib/quest/get-simplified-instructions.ts`

**Modified files:**
- Quest generation prompt (icon output)
- `MissionDetail.tsx` (icons, TTS, simplified, a11y)
- Quest page (wire simplified instructions)

**Prisma changes:**
- `Child.accessibilityMode` field

**Key UX improvements:**
- 🎨 Icon-first instruction display
- 🔊 Read aloud button (Web Speech API)
- ✨ Simplified instructions surface from AdjustmentEvent
- 📱 Accessibility mode with larger tap targets
