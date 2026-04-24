# Quest Buddy 2.0 — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use parallel-plan-execution to implement this plan task-by-task.

**Goal:** Add an interactive mentor chat to every mission day, with Socratic scaffolding, frustration detection, dynamic mission simplification ("Small Adjustment"), and daily reflection.

**Architecture:** Each mission gets one `MentorSession` with a thread of `MentorMessage` records. The mentor AI uses Claude with a Socratic system prompt that adapts based on frustration signals (message count, session duration, negative keywords). When frustration is high, the AI offers a "Small Adjustment" — a simplified version of the current mission instructions stored as an `AdjustmentEvent`. Reflections are stored separately as `ReflectionEntry` records with optional voice file URLs.

**Tech Stack:** Claude API (Socratic mentor), Zod (validation), Prisma/SQLite (persistence), next-intl (i18n for en/id/zh), existing shadcn Button/Dialog

---

## Session 1: Data Layer & Schemas (Tasks 1–4)

Exit criteria: Migration applied, Zod schemas compile, seed runs clean, `bun run build` passes.

### Task 1: Add Prisma models

**Files:**
- Modify: `prisma/schema.prisma` (append after `ModerationEvent` model)

**Step 1: Add four new models to schema.prisma**

Append after the `ModerationEvent` model:

```prisma
model MentorSession {
  id           String          @id @default(cuid())
  missionId    String          @unique
  childId      String
  questId      String
  status       String          @default("active") // "active", "completed"
  adjustmentCount Int          @default(0)
  createdAt    DateTime        @default(now())
  updatedAt    DateTime        @updatedAt
  mission      Mission         @relation(fields: [missionId], references: [id])
  messages     MentorMessage[]
  adjustments  AdjustmentEvent[]

  @@index([childId])
  @@index([questId])
}

model MentorMessage {
  id        String   @id @default(cuid())
  sessionId String
  role      String   // "child" or "mentor"
  content   String
  meta      String?  // JSON stored as text — { quickReply?, suggestions?, frustrationLevel? }
  createdAt DateTime @default(now())

  session   MentorSession @relation(fields: [sessionId], references: [id])

  @@index([sessionId, createdAt])
}

model AdjustmentEvent {
  id                  String   @id @default(cuid())
  sessionId           String
  missionId           String
  originalInstructions String // JSON stored as text — original instruction array
  simplifiedInstructions String // JSON stored as text — simplified instruction array
  reason              String   // "frustration_detected", "child_requested", "time_based"
  createdAt           DateTime @default(now())

  session             MentorSession @relation(fields: [sessionId], references: [id])

  @@index([missionId])
}

model ReflectionEntry {
  id           String   @id @default(cuid())
  childId      String
  questId      String
  missionDay   Int      // Which day the reflection is for (1-7)
  type         String   // "text" or "voice"
  content      String   // Text content or transcription
  fileUrl      String?  // Voice recording URL if type is "voice"
  aiSummary    String?  // AI-generated summary of the reflection
  createdAt    DateTime @default(now())

  @@index([childId])
  @@index([questId])
}
```

**Step 2: Add relation fields to Mission model**

In the `Mission` model, add before the `@@unique` line:

```prisma
  mentorSession      MentorSession?
  adjustmentEvents   AdjustmentEvent[]
```

**Step 3: Run migration**

```bash
bunx prisma migrate dev --name add_mentor_system
```

Expected: Migration file created, schema applied, no errors.

**Step 4: Verify with build**

```bash
bun run build
```

Expected: Build succeeds with no type errors.

**Step 5: Commit**

```bash
git add prisma/ && git commit -m "feat: add MentorSession, MentorMessage, AdjustmentEvent, ReflectionEntry models"
```

---

### Task 2: Create Zod schemas for mentor API

**Files:**
- Create: `src/lib/ai/mentor-schemas.ts`

**Step 1: Create the schema file**

```typescript
/**
 * Zod schemas for the Quest Buddy mentor system.
 *
 * Covers session creation, message exchange, frustration detection,
 * mission adjustment, and daily reflection.
 */
import { z } from "zod";

/** Frustration levels used in mentor context */
export const FrustrationLevelSchema = z.enum(["none", "low", "medium", "high"]);
export type FrustrationLevel = z.infer<typeof FrustrationLevelSchema>;

/** Mentor session status */
export const SessionStatusSchema = z.enum(["active", "completed"]);
export type SessionStatus = z.infer<typeof SessionStatusSchema>;

/** Creating a mentor session (auto on mission start) */
export const CreateSessionInputSchema = z.object({
  questId: z.string().cuid(),
  missionId: z.string().cuid(),
});
export type CreateSessionInput = z.infer<typeof CreateSessionInputSchema>;

/** Sending a message to the mentor */
export const SendMessageInputSchema = z.object({
  sessionId: z.string().cuid(),
  content: z
    .string()
    .min(1, "Message cannot be empty")
    .max(1000, "Message is too long"),
});
export type SendMessageInput = z.infer<typeof SendMessageInputSchema>;

/** Mentor AI response */
export const MentorResponseSchema = z.object({
  message: z.string(),
  suggestions: z.array(z.string()).max(3).optional(),
  frustrationLevel: FrustrationLevelSchema.optional(),
  offerAdjustment: z.boolean().optional(),
});
export type MentorResponse = z.infer<typeof MentorResponseSchema>;

/** Mission adjustment request */
export const AdjustmentInputSchema = z.object({
  sessionId: z.string().cuid(),
  reason: z.enum(["frustration_detected", "child_requested", "time_based"]),
});
export type AdjustmentInput = z.infer<typeof AdjustmentInputSchema>;

/** Simplified mission output from AI */
export const SimplifiedMissionSchema = z.object({
  simplifiedInstructions: z.array(z.string()).min(1).max(6),
  encouragementMessage: z.string(),
});
export type SimplifiedMission = z.infer<typeof SimplifiedMissionSchema>;

/** Daily reflection input */
export const ReflectionInputSchema = z.object({
  questId: z.string().cuid(),
  missionDay: z.number().int().min(1).max(7),
  type: z.enum(["text", "voice"]),
  content: z
    .string()
    .min(5, "Reflection is too short")
    .max(2000, "Reflection is too long"),
  fileUrl: z.string().url().optional(),
});
export type ReflectionInput = z.infer<typeof ReflectionInputSchema>;

/** AI reflection summary */
export const ReflectionSummarySchema = z.object({
  summary: z.string(),
  strengths: z.array(z.string()).max(3),
  encouragement: z.string(),
});
export type ReflectionSummary = z.infer<typeof ReflectionSummarySchema>;
```

**Step 2: Verify build**

```bash
bun run build
```

Expected: Build succeeds.

**Step 3: Commit**

```bash
git add src/lib/ai/mentor-schemas.ts && git commit -m "feat: add Zod schemas for mentor chat, adjustment, and reflection"
```

---

### Task 3: Update seed script

**Files:**
- Modify: `prisma/seed.ts`

**Step 1: Add cleanup for new models**

In the `main()` function, add these lines after the existing `await prisma.moderationEvent.deleteMany()` line (they must come before dependent deletes):

```typescript
await prisma.reflectionEntry.deleteMany();
await prisma.adjustmentEvent.deleteMany();
await prisma.mentorMessage.deleteMany();
await prisma.mentorSession.deleteMany();
```

**Step 2: Verify seed runs**

```bash
bunx prisma db seed
```

Expected: Seed completes without errors.

**Step 3: Commit**

```bash
git add prisma/seed.ts && git commit -m "chore: update seed to clean mentor models"
```

---

### Task 4: Verify Session 1 complete

```bash
bun run build
bunx prisma db seed
```

Expected: Both commands succeed with zero errors.

---

## Session 2: Mentor AI Engine (Tasks 5–8)

Exit criteria: `mentorChat()`, `detectFrustration()`, `simplifyMission()`, `summarizeReflection()` all compile. Mock layer works. `bun run build` passes.

### Task 5: Frustration detection module

**Files:**
- Create: `src/lib/ai/mentor/frustration.ts`

**Step 1: Create frustration detection**

```typescript
/**
 * Frustration detection for the Quest Buddy mentor system.
 *
 * Uses rule-based signals:
 * - Message count in session (more messages without progress → higher frustration)
 * - Session duration (longer than expected → frustration)
 * - Negative keywords in child messages ("can't", "hard", "stuck", "confused", etc.)
 *
 * Returns a frustration level that determines the mentor's response strategy.
 */

import type { FrustrationLevel } from "../mentor-schemas";

/** Negative keywords that signal frustration (case-insensitive) */
const FRUSTRATION_KEYWORDS = [
  "can't", "cant", "cannot", "don't know", "dont know",
  "hard", "difficult", "stuck", "confused", "help",
  "boring", "hate", "give up", "too hard", "impossible",
  "tidak bisa", "sulit", "bingung", "bosan", // Indonesian
  "不会", "太难", "不懂", "无聊", // Chinese
];

interface FrustrationContext {
  messageCount: number;
  childMessageCount: number;
  sessionDurationMinutes: number;
  recentChildMessages: string[];
}

const THRESHOLDS = {
  /** Child messages without completing mission */
  messageCountMedium: 6,
  messageCountHigh: 10,
  /** Session duration in minutes */
  durationMedium: 15,
  durationHigh: 30,
  /** Number of negative keywords to trigger */
  keywordCountMedium: 2,
  keywordCountHigh: 4,
} as const;

/**
 * Detect frustration level from session context.
 *
 * Strategy:
 * - none: Just started or making good progress
 * - low: Some signals but not concerning
 * - medium: Multiple signals — mentor should offer guided hints
 * - high: Strong signals — mentor should offer a "Small Adjustment"
 */
export function detectFrustration(
  context: FrustrationContext,
): FrustrationLevel {
  let score = 0;

  // Message count signal
  if (context.childMessageCount >= THRESHOLDS.messageCountHigh) {
    score += 3;
  } else if (context.childMessageCount >= THRESHOLDS.messageCountMedium) {
    score += 1;
  }

  // Duration signal
  if (context.sessionDurationMinutes >= THRESHOLDS.durationHigh) {
    score += 3;
  } else if (context.sessionDurationMinutes >= THRESHOLDS.durationMedium) {
    score += 1;
  }

  // Keyword signal
  const keywordHits = countNegativeKeywords(context.recentChildMessages);
  if (keywordHits >= THRESHOLDS.keywordCountHigh) {
    score += 3;
  } else if (keywordHits >= THRESHOLDS.keywordCountMedium) {
    score += 1;
  }

  // Map score to level
  if (score >= 5) return "high";
  if (score >= 3) return "medium";
  if (score >= 1) return "low";
  return "none";
}

function countNegativeKeywords(messages: string[]): number {
  const allText = messages.join(" ").toLowerCase();
  return FRUSTRATION_KEYWORDS.filter((kw) => allText.includes(kw)).length;
}
```

**Step 2: Verify build**

```bash
bun run build
```

**Step 3: Commit**

```bash
git add src/lib/ai/mentor/frustration.ts && git commit -m "feat: add rule-based frustration detection for mentor chat"
```

---

### Task 6: Mentor chat AI (Claude + mock)

**Files:**
- Create: `src/lib/ai/mentor/chat.ts`
- Create: `src/lib/ai/mentor/mock-chat.ts`
- Create: `src/lib/ai/mentor/index.ts`

**Step 1: Create mock mentor chat**

```typescript
/**
 * Mock mentor chat responses for development.
 *
 * Returns deterministic Socratic-style mentor messages that adapt
 * based on frustration level. Simulates API latency.
 */

import type { MentorResponse, FrustrationLevel } from "../mentor-schemas";

const NONE_RESPONSES: MentorResponse[] = [
  {
    message: "That's a great observation! 🌟 What do you think would happen if you tried the next step?",
    suggestions: ["I'm not sure, what should I do?", "Let me try something!", "Can you give me a hint?"],
    frustrationLevel: "none",
  },
  {
    message: "Interesting approach! Can you tell me more about why you chose to do it that way?",
    suggestions: ["I saw it in a book", "I just guessed", "It felt right"],
    frustrationLevel: "none",
  },
  {
    message: "You're thinking like a real scientist! What's the most interesting thing you've noticed so far?",
    suggestions: ["The materials are cool", "It's harder than I thought", "I want to try something different"],
    frustrationLevel: "none",
  },
];

const LOW_RESPONSES: MentorResponse[] = [
  {
    message: "That's okay! Sometimes the best ideas come from trying different things. What part are you working on right now?",
    suggestions: ["I'm on step 2", "I finished but it doesn't look right", "I need help getting started"],
    frustrationLevel: "low",
  },
  {
    message: "Every inventor faces challenges — that's how they learn! Let's think about this together. What have you tried so far?",
    suggestions: ["I tried following the steps", "I made something different", "Nothing seems to work"],
    frustrationLevel: "low",
  },
];

const MEDIUM_RESPONSES: MentorResponse[] = [
  {
    message: "It sounds like this part is a bit tricky. That's totally normal! Here's a hint: look at the materials list again — is there something you could use differently? 🤔",
    suggestions: ["Show me an easier way", "I want to keep trying", "Can we adjust the mission?"],
    frustrationLevel: "medium",
  },
  {
    message: "You've been working hard on this! Sometimes a small change can make everything click. Want me to suggest a simpler approach, or do you want to keep going?",
    suggestions: ["Yes, make it simpler please", "No, I can do this!", "Just give me a hint"],
    frustrationLevel: "medium",
    offerAdjustment: true,
  },
];

const HIGH_RESPONSES: MentorResponse[] = [
  {
    message: "Hey, you've been really persistent — that's an amazing quality! 💪 I think we should try a Small Adjustment. This means we'll simplify the steps a bit so you can still build something awesome. What do you think?",
    suggestions: ["Yes, let's try the Small Adjustment!", "I want to keep the original plan", "Tell me more about the adjustment"],
    frustrationLevel: "high",
    offerAdjustment: true,
  },
  {
    message: "You know what? Even professional engineers sometimes need to simplify their plans. It's not giving up — it's being smart! Let me suggest a Small Adjustment that still gets you to your goal. Sound good?",
    suggestions: ["Okay, let's try it!", "I'd rather figure this out myself", "What's the adjustment?"],
    frustrationLevel: "high",
    offerAdjustment: true,
  },
];

const GREETING_RESPONSE: MentorResponse = {
  message: "Hi there! 🎉 I'm your Quest Buddy for today! I'm here to help you think through this mission, but I won't just give you answers — I'll ask questions to help YOU figure it out. That's how real creators learn! Ready to start?",
  suggestions: ["Yes, let's go!", "Can you explain the mission?", "I'm not sure what to do first"],
  frustrationLevel: "none",
};

function pickRandom<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

export async function getMockMentorChat(
  childMessage: string | null,
  frustrationLevel: FrustrationLevel,
  isGreeting: boolean,
): Promise<MentorResponse> {
  // Simulate API latency (800–1500ms)
  const delay = 800 + Math.random() * 700;
  await new Promise((resolve) => setTimeout(resolve, delay));

  if (isGreeting) return GREETING_RESPONSE;

  switch (frustrationLevel) {
    case "high":
      return pickRandom(HIGH_RESPONSES);
    case "medium":
      return pickRandom(MEDIUM_RESPONSES);
    case "low":
      return pickRandom(LOW_RESPONSES);
    default:
      return pickRandom(NONE_RESPONSES);
  }
}

export async function getMockSimplifiedMission(): Promise<{
  simplifiedInstructions: string[];
  encouragementMessage: string;
}> {
  await new Promise((resolve) => setTimeout(resolve, 600 + Math.random() * 400));

  return {
    simplifiedInstructions: [
      "Start with just the base — don't worry about the extra parts yet",
      "Use the simplest materials you have (tape and cardboard work great!)",
      "Focus on making ONE part work first",
      "Test it and see what happens — that's the fun part!",
    ],
    encouragementMessage:
      "Remember: every great invention started simple and got better over time. You're doing amazing! 🌟",
  };
}

export async function getMockReflectionSummary(): Promise<{
  summary: string;
  strengths: string[];
  encouragement: string;
}> {
  await new Promise((resolve) => setTimeout(resolve, 500 + Math.random() * 500));

  return {
    summary: "You showed great curiosity and willingness to try new things during this mission.",
    strengths: ["Creative thinking", "Persistence", "Problem-solving attitude"],
    encouragement:
      "You're growing as a creator every day! Keep exploring and asking questions — that's what makes you special. 🌟",
  };
}
```

**Step 2: Create mentor chat with Claude integration**

```typescript
/**
 * Quest Buddy mentor chat — Socratic scaffolding engine.
 *
 * Uses Claude to generate question-first guidance that adapts to the
 * child's frustration level. The mentor never gives direct answers;
 * instead, it asks questions that lead the child to discover solutions.
 *
 * When frustration is detected, the mentor offers a "Small Adjustment" —
 * a simplified version of the mission that avoids failure framing.
 */

import type {
  MentorResponse,
  SimplifiedMission,
  ReflectionSummary,
  FrustrationLevel,
} from "../mentor-schemas";
import { getMockMentorChat, getMockSimplifiedMission, getMockReflectionSummary } from "./mock-chat";

const API_TIMEOUT_MS = 30_000;

/** System prompt for the Socratic mentor */
const MENTOR_SYSTEM_PROMPT = `You are a warm, encouraging mentor for children aged 6–12. You guide them through creative missions using SOCRATIC QUESTIONING — you NEVER give direct answers or solutions. Instead, you ask questions that help the child think and discover answers themselves.

CRITICAL RULES:
1. NEVER say: "fail", "wrong", "mistake", "incorrect", "try again", "that's not right"
2. ALWAYS say: "small adjustment", "different approach", "interesting idea", "let's explore"
3. Keep responses SHORT (1–3 sentences max). Children lose attention with long text.
4. Use simple words. The child may be a pre-reader or early reader.
5. Be genuinely curious about their ideas. Celebrate their thinking process.
6. Use emojis sparingly (1–2 per message max) for warmth.

FRUSTRATION ADAPTATION:
- none: Ask open-ended questions ("What do you think would happen if…?")
- low: Offer gentle hints ("Have you looked at the materials list?")
- medium: Give guided hints + offer "Small Adjustment" option
- high: Strongly suggest a "Small Adjustment" — simplify the mission

When offering a "Small Adjustment", explain it as a SMART choice, not a step back.
Say things like: "Let's try a Small Adjustment — this is what real engineers do when they want to make progress faster!"

RESPONSE FORMAT — respond ONLY with valid JSON:
{
  "message": "Your mentor message (1-3 sentences)",
  "suggestions": ["Quick reply option 1", "Quick reply option 2", "Quick reply option 3"],
  "frustrationLevel": "none|low|medium|high",
  "offerAdjustment": false
}

Always provide exactly 3 quick reply suggestions that the child can tap.`;

/** Context builder — assembles the conversation context for Claude */
function buildUserMessage(
  childMessage: string | null,
  frustrationLevel: FrustrationLevel,
  missionContext: {
    day: number;
    title: string;
    description: string;
    instructions: string[];
    materials: string[];
  },
  chatHistory: Array<{ role: string; content: string }>,
  isGreeting: boolean,
): string {
  const missionInfo = `[Mission Context — Day ${missionContext.day}: ${missionContext.title}]
Description: ${missionContext.description}
Instructions: ${missionContext.instructions.map((s, i) => `${i + 1}. ${s}`).join("\n")}
Materials: ${missionContext.materials.join(", ")}
Current Frustration Level: ${frustrationLevel}`;

  if (isGreeting) {
    return `${missionInfo}\n\nThe child just started this mission. Greet them warmly and introduce yourself as their Quest Buddy. Ask an opening question about the mission.`;
  }

  const recentHistory = chatHistory
    .slice(-6)
    .map((m) => `${m.role === "child" ? "Child" : "Mentor"}: ${m.content}`)
    .join("\n");

  return `${missionInfo}\n\n[Recent conversation]\n${recentHistory}\n\nChild says: "${childMessage}"\n\nRespond as the mentor. Remember to use Socratic questioning and adapt to the frustration level.`;
}

/**
 * Send a message to the mentor and get a Socratic response.
 */
export async function mentorChat(
  childMessage: string | null,
  frustrationLevel: FrustrationLevel,
  missionContext: {
    day: number;
    title: string;
    description: string;
    instructions: string[];
    materials: string[];
  },
  chatHistory: Array<{ role: string; content: string }>,
  isGreeting: boolean,
): Promise<MentorResponse> {
  if (process.env.USE_MOCK_AI === "true") {
    return getMockMentorChat(childMessage, frustrationLevel, isGreeting);
  }

  return callClaudeMentor(childMessage, frustrationLevel, missionContext, chatHistory, isGreeting);
}

async function callClaudeMentor(
  childMessage: string | null,
  frustrationLevel: FrustrationLevel,
  missionContext: {
    day: number;
    title: string;
    description: string;
    instructions: string[];
    materials: string[];
  },
  chatHistory: Array<{ role: string; content: string }>,
  isGreeting: boolean,
): Promise<MentorResponse> {
  const Anthropic = (await import("@anthropic-ai/sdk")).default;

  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    timeout: API_TIMEOUT_MS,
  });

  const userMessage = buildUserMessage(childMessage, frustrationLevel, missionContext, chatHistory, isGreeting);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    const response = await client.messages.create(
      {
        model: "claude-sonnet-4-20250514",
        max_tokens: 500,
        system: MENTOR_SYSTEM_PROMPT,
        messages: [{ role: "user", content: userMessage }],
      },
      { signal: controller.signal },
    );

    clearTimeout(timeoutId);

    const textBlock = response.content.find(
      (block: { type: string }) => block.type === "text",
    );
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("Empty response from Claude");
    }

    const parsed = JSON.parse(textBlock.text);
    const { MentorResponseSchema } = await import("../mentor-schemas");
    return MentorResponseSchema.parse(parsed);
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("Mentor chat timed out. Please try again.");
    }
    throw error;
  }
}

const SIMPLIFY_SYSTEM_PROMPT = `You are a children's education specialist. Given mission instructions that are too complex, create a SIMPLIFIED version that:
1. Has fewer steps (3-4 instead of 5-6)
2. Uses simpler materials
3. Achieves the SAME learning goal
4. Is framed as a "Small Adjustment" — a smart choice, not a downgrade

NEVER use the words "fail", "wrong", "mistake", "easier". Always use "simpler approach", "small adjustment", "focused version".

Respond ONLY with valid JSON:
{
  "simplifiedInstructions": ["Step 1...", "Step 2...", "Step 3..."],
  "encouragementMessage": "A short, encouraging message about the adjustment"
}`;

/**
 * Generate simplified mission instructions via AI.
 */
export async function simplifyMission(
  originalInstructions: string[],
  missionTitle: string,
  materials: string[],
): Promise<SimplifiedMission> {
  if (process.env.USE_MOCK_AI === "true") {
    return getMockSimplifiedMission();
  }

  const Anthropic = (await import("@anthropic-ai/sdk")).default;
  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    timeout: API_TIMEOUT_MS,
  });

  const userMessage = `Mission: "${missionTitle}"
Original Instructions: ${JSON.stringify(originalInstructions)}
Available Materials: ${materials.join(", ")}

Create a simplified version of these instructions (3-4 steps max) using the simplest materials.`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    const response = await client.messages.create(
      {
        model: "claude-sonnet-4-20250514",
        max_tokens: 400,
        system: SIMPLIFY_SYSTEM_PROMPT,
        messages: [{ role: "user", content: userMessage }],
      },
      { signal: controller.signal },
    );

    clearTimeout(timeoutId);

    const textBlock = response.content.find(
      (block: { type: string }) => block.type === "text",
    );
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("Empty response from Claude");
    }

    const parsed = JSON.parse(textBlock.text);
    const { SimplifiedMissionSchema } = await import("../mentor-schemas");
    return SimplifiedMissionSchema.parse(parsed);
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

const REFLECTION_SYSTEM_PROMPT = `You are a warm children's development specialist. Given a child's daily reflection about their mission, provide:
1. A brief, encouraging summary of what they shared (2-3 sentences)
2. Up to 3 specific strengths they showed (short phrases)
3. An encouraging closing message

NEVER be critical. Always find the positive. Use simple language.

Respond ONLY with valid JSON:
{
  "summary": "Brief summary...",
  "strengths": ["Strength 1", "Strength 2", "Strength 3"],
  "encouragement": "Encouraging closing message"
}`;

/**
 * Generate an AI summary of a child's daily reflection.
 */
export async function summarizeReflection(
  reflectionText: string,
  missionDay: number,
  missionTitle: string,
): Promise<ReflectionSummary> {
  if (process.env.USE_MOCK_AI === "true") {
    return getMockReflectionSummary();
  }

  const Anthropic = (await import("@anthropic-ai/sdk")).default;
  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    timeout: API_TIMEOUT_MS,
  });

  const userMessage = `Day ${missionDay}: "${missionTitle}"

Child's reflection:
"${reflectionText}"

Summarize this reflection with encouragement.`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    const response = await client.messages.create(
      {
        model: "claude-sonnet-4-20250514",
        max_tokens: 300,
        system: REFLECTION_SYSTEM_PROMPT,
        messages: [{ role: "user", content: userMessage }],
      },
      { signal: controller.signal },
    );

    clearTimeout(timeoutId);

    const textBlock = response.content.find(
      (block: { type: string }) => block.type === "text",
    );
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("Empty response from Claude");
    }

    const parsed = JSON.parse(textBlock.text);
    const { ReflectionSummarySchema } = await import("../mentor-schemas");
    return ReflectionSummarySchema.parse(parsed);
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}
```

**Step 3: Create barrel export**

```typescript
/**
 * Quest Buddy mentor system — barrel export.
 */

export { mentorChat, simplifyMission, summarizeReflection } from "./chat";
export { detectFrustration } from "./frustration";
```

**Step 4: Verify build**

```bash
bun run build
```

Expected: Build succeeds.

**Step 5: Commit**

```bash
git add src/lib/ai/mentor/ && git commit -m "feat: add mentor chat engine with Socratic scaffolding, frustration detection, and mission simplification"
```

---

### Task 7: Verify Session 2 complete

```bash
bun run build
```

Expected: Build succeeds with all new modules compiling.

---

## Session 3: API Routes (Tasks 8–12)

Exit criteria: All 4 API routes compile, respond correctly to curl tests (with mock AI), `bun run build` passes.

### Task 8: Mentor session API — GET/POST

**Files:**
- Create: `src/app/api/mentor/session/route.ts`

**Step 1: Create the route**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getChildSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { CreateSessionInputSchema } from "@/lib/ai/mentor-schemas";

/**
 * GET /api/mentor/session?missionId=xxx
 *
 * Fetches the mentor session for a specific mission.
 * Creates one automatically if the mission is in_progress and no session exists.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getChildSession();
    if (!session) {
      return NextResponse.json(
        { error: "unauthorized", message: "Authentication required" },
        { status: 401 },
      );
    }

    const missionId = request.nextUrl.searchParams.get("missionId");
    if (!missionId) {
      return NextResponse.json(
        { error: "invalid", message: "missionId is required" },
        { status: 400 },
      );
    }

    // Find or create mentor session
    let mentorSession = await prisma.mentorSession.findUnique({
      where: { missionId },
      include: {
        messages: { orderBy: { createdAt: "asc" } },
        adjustments: { orderBy: { createdAt: "desc" } },
      },
    });

    if (!mentorSession) {
      // Auto-create if mission is in_progress and belongs to this child
      const mission = await prisma.mission.findUnique({
        where: { id: missionId },
        include: { quest: true },
      });

      if (!mission || mission.quest.childId !== session.childId) {
        return NextResponse.json(
          { error: "not_found", message: "Mission not found" },
          { status: 404 },
        );
      }

      if (mission.status !== "in_progress") {
        return NextResponse.json(
          { error: "invalid_state", message: "Mission must be in progress to start mentor chat" },
          { status: 400 },
        );
      }

      mentorSession = await prisma.mentorSession.create({
        data: {
          missionId,
          childId: session.childId,
          questId: mission.questId,
          status: "active",
        },
        include: {
          messages: { orderBy: { createdAt: "asc" } },
          adjustments: { orderBy: { createdAt: "desc" } },
        },
      });
    }

    // Verify ownership
    if (mentorSession.childId !== session.childId) {
      return NextResponse.json(
        { error: "forbidden", message: "Access denied" },
        { status: 403 },
      );
    }

    return NextResponse.json({
      id: mentorSession.id,
      missionId: mentorSession.missionId,
      status: mentorSession.status,
      adjustmentCount: mentorSession.adjustmentCount,
      messages: mentorSession.messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        meta: m.meta ? JSON.parse(m.meta) : null,
        createdAt: m.createdAt.toISOString(),
      })),
      adjustments: mentorSession.adjustments.map((a) => ({
        id: a.id,
        reason: a.reason,
        simplifiedInstructions: JSON.parse(a.simplifiedInstructions),
        createdAt: a.createdAt.toISOString(),
      })),
      createdAt: mentorSession.createdAt.toISOString(),
    });
  } catch (error) {
    console.error("Mentor session GET error:", error);
    return NextResponse.json(
      { error: "server_error", message: "Failed to fetch mentor session" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/mentor/session
 *
 * Explicitly create a mentor session for a mission.
 * Body: { questId, missionId }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getChildSession();
    if (!session) {
      return NextResponse.json(
        { error: "unauthorized", message: "Authentication required" },
        { status: 401 },
      );
    }

    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json(
        { error: "invalid", message: "Invalid request body" },
        { status: 400 },
      );
    }

    const parsed = CreateSessionInputSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "invalid", message: parsed.error.issues[0]?.message ?? "Invalid request" },
        { status: 400 },
      );
    }

    const { questId, missionId } = parsed.data;

    // Verify mission exists and belongs to child
    const mission = await prisma.mission.findUnique({
      where: { id: missionId },
      include: { quest: true },
    });

    if (!mission || mission.quest.id !== questId || mission.quest.childId !== session.childId) {
      return NextResponse.json(
        { error: "not_found", message: "Mission not found" },
        { status: 404 },
      );
    }

    // Check for existing session
    const existing = await prisma.mentorSession.findUnique({
      where: { missionId },
    });

    if (existing) {
      return NextResponse.json(
        { error: "exists", message: "Session already exists for this mission" },
        { status: 409 },
      );
    }

    const mentorSession = await prisma.mentorSession.create({
      data: {
        missionId,
        childId: session.childId,
        questId,
        status: "active",
      },
    });

    return NextResponse.json({
      id: mentorSession.id,
      missionId: mentorSession.missionId,
      status: mentorSession.status,
      createdAt: mentorSession.createdAt.toISOString(),
    }, { status: 201 });
  } catch (error) {
    console.error("Mentor session POST error:", error);
    return NextResponse.json(
      { error: "server_error", message: "Failed to create mentor session" },
      { status: 500 },
    );
  }
}
```

**Step 2: Verify build**

```bash
bun run build
```

**Step 3: Commit**

```bash
git add src/app/api/mentor/session/route.ts && git commit -m "feat: add GET/POST /api/mentor/session — auto-create on mission start"
```

---

### Task 9: Mentor message API

**Files:**
- Create: `src/app/api/mentor/message/route.ts`

**Step 1: Create the route**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getChildSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { sanitizeInput } from "@/lib/sanitize";
import { SendMessageInputSchema } from "@/lib/ai/mentor-schemas";
import { mentorChat, detectFrustration } from "@/lib/ai/mentor";

/**
 * POST /api/mentor/message
 *
 * Sends a child message to the mentor and gets a Socratic response.
 * Automatically detects frustration and adapts the response.
 *
 * Body: { sessionId, content }
 * Optional: send content=null with a sessionId to get a greeting.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getChildSession();
    if (!session) {
      return NextResponse.json(
        { error: "unauthorized", message: "Authentication required" },
        { status: 401 },
      );
    }

    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json(
        { error: "invalid", message: "Invalid request body" },
        { status: 400 },
      );
    }

    // Allow null content for greeting requests
    if (body.content === null || body.content === undefined) {
      body.content = "";
    }

    const parsed = SendMessageInputSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "invalid", message: parsed.error.issues[0]?.message ?? "Invalid request" },
        { status: 400 },
      );
    }

    const { sessionId, content } = parsed.data;
    const isGreeting = content === "";

    // Sanitize child message
    const sanitizedContent = isGreeting ? "" : sanitizeInput(content);

    // Fetch session with mission context
    const mentorSession = await prisma.mentorSession.findUnique({
      where: { id: sessionId },
      include: {
        messages: { orderBy: { createdAt: "asc" } },
        adjustments: true,
      },
    });

    if (!mentorSession) {
      return NextResponse.json(
        { error: "not_found", message: "Session not found" },
        { status: 404 },
      );
    }

    if (mentorSession.childId !== session.childId) {
      return NextResponse.json(
        { error: "forbidden", message: "Access denied" },
        { status: 403 },
      );
    }

    if (mentorSession.status !== "active") {
      return NextResponse.json(
        { error: "invalid_state", message: "Session is no longer active" },
        { status: 400 },
      );
    }

    // Fetch mission context
    const mission = await prisma.mission.findUnique({
      where: { id: mentorSession.missionId },
    });

    if (!mission) {
      return NextResponse.json(
        { error: "not_found", message: "Mission not found" },
        { status: 404 },
      );
    }

    // Parse JSON fields from mission
    const instructions: string[] = (() => {
      try { return JSON.parse(mission.instructions); } catch { return []; }
    })();
    const materials: string[] = (() => {
      try { return JSON.parse(mission.materials); } catch { return []; }
    })();

    // Check for active adjustment — use simplified instructions if present
    const activeAdjustment = mentorSession.adjustments[0]; // Most recent
    const activeInstructions = activeAdjustment
      ? (() => { try { return JSON.parse(activeAdjustment.simplifiedInstructions); } catch { return instructions; } })()
      : instructions;

    // Save child message (if not greeting)
    if (!isGreeting) {
      await prisma.mentorMessage.create({
        data: {
          sessionId,
          role: "child",
          content: sanitizedContent,
        },
      });
    }

    // Detect frustration
    const childMessages = mentorSession.messages
      .filter((m) => m.role === "child")
      .map((m) => m.content)
      .concat(isGreeting ? [] : [sanitizedContent]);

    const sessionDurationMinutes = (Date.now() - mentorSession.createdAt.getTime()) / 60_000;

    const frustrationLevel = detectFrustration({
      messageCount: mentorSession.messages.length + (isGreeting ? 0 : 1),
      childMessageCount: childMessages.length,
      sessionDurationMinutes,
      recentChildMessages: childMessages.slice(-5),
    });

    // Get mentor response
    const chatHistory = mentorSession.messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const mentorResponse = await mentorChat(
      isGreeting ? null : sanitizedContent,
      frustrationLevel,
      {
        day: mission.day,
        title: mission.title,
        description: mission.description,
        instructions: activeInstructions,
        materials,
      },
      chatHistory,
      isGreeting,
    );

    // Save mentor message
    const savedMentorMessage = await prisma.mentorMessage.create({
      data: {
        sessionId,
        role: "mentor",
        content: mentorResponse.message,
        meta: JSON.stringify({
          suggestions: mentorResponse.suggestions,
          frustrationLevel: mentorResponse.frustrationLevel ?? frustrationLevel,
          offerAdjustment: mentorResponse.offerAdjustment,
        }),
      },
    });

    return NextResponse.json({
      message: {
        id: savedMentorMessage.id,
        role: "mentor",
        content: mentorResponse.message,
        suggestions: mentorResponse.suggestions,
        frustrationLevel: mentorResponse.frustrationLevel ?? frustrationLevel,
        offerAdjustment: mentorResponse.offerAdjustment,
        createdAt: savedMentorMessage.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("Mentor message error:", error);

    if (error instanceof Error && error.message.includes("timed out")) {
      return NextResponse.json(
        { error: "timeout", message: "Mentor is thinking too long. Please try again!" },
        { status: 504 },
      );
    }

    return NextResponse.json(
      { error: "server_error", message: "Failed to get mentor response" },
      { status: 500 },
    );
  }
}
```

**Step 2: Verify build**

```bash
bun run build
```

**Step 3: Commit**

```bash
git add src/app/api/mentor/message/route.ts && git commit -m "feat: add POST /api/mentor/message — Socratic chat with frustration detection"
```

---

### Task 10: Mission adjustment API

**Files:**
- Create: `src/app/api/mentor/adjust/route.ts`

**Step 1: Create the route**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getChildSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AdjustmentInputSchema } from "@/lib/ai/mentor-schemas";
import { simplifyMission } from "@/lib/ai/mentor";

/**
 * POST /api/mentor/adjust
 *
 * Creates a "Small Adjustment" — simplified mission instructions.
 * Records the adjustment event and increments the session's adjustment count.
 *
 * Body: { sessionId, reason }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getChildSession();
    if (!session) {
      return NextResponse.json(
        { error: "unauthorized", message: "Authentication required" },
        { status: 401 },
      );
    }

    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json(
        { error: "invalid", message: "Invalid request body" },
        { status: 400 },
      );
    }

    const parsed = AdjustmentInputSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "invalid", message: parsed.error.issues[0]?.message ?? "Invalid request" },
        { status: 400 },
      );
    }

    const { sessionId, reason } = parsed.data;

    const mentorSession = await prisma.mentorSession.findUnique({
      where: { id: sessionId },
    });

    if (!mentorSession) {
      return NextResponse.json(
        { error: "not_found", message: "Session not found" },
        { status: 404 },
      );
    }

    if (mentorSession.childId !== session.childId) {
      return NextResponse.json(
        { error: "forbidden", message: "Access denied" },
        { status: 403 },
      );
    }

    // Limit adjustments per session (max 3)
    if (mentorSession.adjustmentCount >= 3) {
      return NextResponse.json(
        { error: "limit_reached", message: "Maximum adjustments reached for this mission" },
        { status: 400 },
      );
    }

    // Fetch mission
    const mission = await prisma.mission.findUnique({
      where: { id: mentorSession.missionId },
    });

    if (!mission) {
      return NextResponse.json(
        { error: "not_found", message: "Mission not found" },
        { status: 404 },
      );
    }

    const originalInstructions: string[] = (() => {
      try { return JSON.parse(mission.instructions); } catch { return []; }
    })();
    const materials: string[] = (() => {
      try { return JSON.parse(mission.materials); } catch { return []; }
    })();

    // Generate simplified instructions
    const simplified = await simplifyMission(
      originalInstructions,
      mission.title,
      materials,
    );

    // Save adjustment event + update session in transaction
    const result = await prisma.$transaction(async (tx) => {
      const adjustment = await tx.adjustmentEvent.create({
        data: {
          sessionId,
          missionId: mentorSession.missionId,
          originalInstructions: JSON.stringify(originalInstructions),
          simplifiedInstructions: JSON.stringify(simplified.simplifiedInstructions),
          reason,
        },
      });

      await tx.mentorSession.update({
        where: { id: sessionId },
        data: { adjustmentCount: { increment: 1 } },
      });

      return adjustment;
    });

    // Save encouragement message as a mentor message
    await prisma.mentorMessage.create({
      data: {
        sessionId,
        role: "mentor",
        content: simplified.encouragementMessage,
        meta: JSON.stringify({
          type: "adjustment",
          adjustmentId: result.id,
        }),
      },
    });

    return NextResponse.json({
      adjustment: {
        id: result.id,
        simplifiedInstructions: simplified.simplifiedInstructions,
        encouragementMessage: simplified.encouragementMessage,
        reason,
        createdAt: result.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("Mission adjustment error:", error);

    if (error instanceof Error && error.message.includes("timed out")) {
      return NextResponse.json(
        { error: "timeout", message: "Adjustment is taking too long. Please try again!" },
        { status: 504 },
      );
    }

    return NextResponse.json(
      { error: "server_error", message: "Failed to create adjustment" },
      { status: 500 },
    );
  }
}
```

**Step 2: Verify build**

```bash
bun run build
```

**Step 3: Commit**

```bash
git add src/app/api/mentor/adjust/route.ts && git commit -m "feat: add POST /api/mentor/adjust — Small Adjustment with AI simplification"
```

---

### Task 11: Daily reflection API

**Files:**
- Create: `src/app/api/reflection/daily/route.ts`

**Step 1: Create the route**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getChildSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { sanitizeInput } from "@/lib/sanitize";
import { isAllowedStorageUrl } from "@/lib/url-allowlist";
import { ReflectionInputSchema } from "@/lib/ai/mentor-schemas";
import { summarizeReflection } from "@/lib/ai/mentor";

/**
 * POST /api/reflection/daily
 *
 * Save a child's daily reflection and generate an AI summary.
 * Supports both text and voice reflections.
 *
 * Body: { questId, missionDay, type, content, fileUrl? }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getChildSession();
    if (!session) {
      return NextResponse.json(
        { error: "unauthorized", message: "Authentication required" },
        { status: 401 },
      );
    }

    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json(
        { error: "invalid", message: "Invalid request body" },
        { status: 400 },
      );
    }

    const parsed = ReflectionInputSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "invalid", message: parsed.error.issues[0]?.message ?? "Invalid request" },
        { status: 400 },
      );
    }

    const { questId, missionDay, type, content, fileUrl } = parsed.data;

    // Verify quest ownership
    const quest = await prisma.quest.findUnique({
      where: { id: questId },
    });

    if (!quest || quest.childId !== session.childId) {
      return NextResponse.json(
        { error: "not_found", message: "Quest not found" },
        { status: 404 },
      );
    }

    // Validate voice URL if provided
    const sanitizedContent = sanitizeInput(content);
    let sanitizedFileUrl: string | undefined;

    if (fileUrl) {
      sanitizedFileUrl = sanitizeInput(fileUrl);
      if (!isAllowedStorageUrl(sanitizedFileUrl)) {
        return NextResponse.json(
          { error: "invalid", message: "Invalid file URL" },
          { status: 400 },
        );
      }
    }

    // Check for duplicate reflection (one per mission day per quest)
    const existing = await prisma.reflectionEntry.findFirst({
      where: { childId: session.childId, questId, missionDay },
    });

    if (existing) {
      return NextResponse.json(
        { error: "exists", message: "Reflection already exists for this mission day" },
        { status: 409 },
      );
    }

    // Get mission title for context
    const mission = await prisma.mission.findFirst({
      where: { questId, day: missionDay },
    });

    const missionTitle = mission?.title ?? `Day ${missionDay}`;

    // Generate AI summary
    const aiSummary = await summarizeReflection(
      sanitizedContent,
      missionDay,
      missionTitle,
    );

    // Save reflection
    const reflection = await prisma.reflectionEntry.create({
      data: {
        childId: session.childId,
        questId,
        missionDay,
        type,
        content: sanitizedContent,
        fileUrl: sanitizedFileUrl,
        aiSummary: JSON.stringify(aiSummary),
      },
    });

    return NextResponse.json({
      id: reflection.id,
      missionDay,
      type,
      aiSummary,
      createdAt: reflection.createdAt.toISOString(),
    }, { status: 201 });
  } catch (error) {
    console.error("Reflection error:", error);

    if (error instanceof Error && error.message.includes("timed out")) {
      return NextResponse.json(
        { error: "timeout", message: "Reflection summary is taking too long. Please try again!" },
        { status: 504 },
      );
    }

    return NextResponse.json(
      { error: "server_error", message: "Failed to save reflection" },
      { status: 500 },
    );
  }
}
```

**Step 2: Verify build**

```bash
bun run build
```

**Step 3: Commit**

```bash
git add src/app/api/reflection/daily/route.ts && git commit -m "feat: add POST /api/reflection/daily — save reflection with AI summary"
```

---

### Task 12: Auto-create mentor session on mission start

**Files:**
- Modify: `src/app/api/quest/[id]/mission/[missionId]/route.ts`

**Step 1: Add mentor session creation to "start" action**

After the line that updates the mission status to "in_progress" (around line 131), add mentor session auto-creation:

Find this block:
```typescript
const updatedMission = await prisma.mission.update({
  where: { id: missionId },
  data: { status: "in_progress" },
});
```

Replace with:
```typescript
const updatedMission = await prisma.mission.update({
  where: { id: missionId },
  data: { status: "in_progress" },
});

// Auto-create mentor session for this mission
await prisma.mentorSession.upsert({
  where: { missionId },
  create: {
    missionId,
    childId: session.childId,
    questId,
    status: "active",
  },
  update: {},
});
```

**Step 2: Verify build**

```bash
bun run build
```

**Step 3: Commit**

```bash
git add src/app/api/quest/ && git commit -m "feat: auto-create mentor session when child starts a mission"
```

---

## Session 4: UI & i18n (Tasks 13–17)

Exit criteria: Mission chat UI renders in quest overview page, i18n complete for en/id/zh, `bun run build` passes.

### Task 13: Add i18n translations

**Files:**
- Modify: `messages/en.json`
- Modify: `messages/id.json`
- Modify: `messages/zh.json`

**Step 1: Add English translations**

Add a new top-level `"mentor"` key (after `"quest"` block, before `"gallery"`):

```json
"mentor": {
  "chatTitle": "Quest Buddy",
  "chatSubtitle": "Your thinking companion for this mission",
  "greeting": "Start Chat",
  "placeholder": "Type your message...",
  "send": "Send",
  "thinking": "Thinking...",
  "suggestions": "Quick Replies",
  "adjustment": {
    "title": "Small Adjustment",
    "description": "Let's try a simpler approach — real engineers do this all the time!",
    "accept": "Yes, Let's Adjust!",
    "decline": "I'll Keep Trying",
    "applied": "Mission instructions updated with simpler steps",
    "limit": "Maximum adjustments reached for this mission"
  },
  "reflection": {
    "title": "Daily Reflection",
    "subtitle": "Share what you learned today!",
    "textPlaceholder": "What did you enjoy most about today's mission? What did you learn?",
    "voiceButton": "Record Reflection",
    "submitButton": "Save Reflection",
    "success": "Reflection saved! Great job thinking about your learning!",
    "alreadyExists": "You already shared a reflection for this day",
    "encouragement": "Every great creator takes time to think about what they learned!"
  }
}
```

**Step 2: Add Indonesian and Chinese translations** (same structure, translated values)

For `messages/id.json` — same key structure with Indonesian translations.
For `messages/zh.json` — same key structure with Chinese translations.

The implementer should add these with appropriate translations following the pattern of existing keys in those files.

**Step 3: Verify build**

```bash
bun run build
```

**Step 4: Commit**

```bash
git add messages/ && git commit -m "feat: add mentor chat i18n translations for en/id/zh"
```

---

### Task 14: MissionChat component

**Files:**
- Create: `src/components/quest/MissionChat.tsx`

**Step 1: Create the chat component**

This is a `"use client"` component that:
1. Fetches the mentor session for the current mission on mount
2. Displays a chat thread with messages
3. Has a text input + send button at the bottom
4. Shows quick-reply suggestions after each mentor message
5. Shows "Small Adjustment" button when mentor offers it
6. Uses `useTranslations("mentor")` for all text

Key design decisions:
- Chat appears below the mission detail when mission is `in_progress`
- Collapsed by default, expands with a toggle button
- Messages auto-scroll to bottom on new message
- Quick replies are tappable suggestion chips
- Adjustment offer appears as an inline card

**Step 2: Verify build**

```bash
bun run build
```

**Step 3: Commit**

```bash
git add src/components/quest/MissionChat.tsx && git commit -m "feat: add MissionChat component with Socratic thread, quick replies, and adjustment UI"
```

---

### Task 15: Integrate chat into quest overview page

**Files:**
- Modify: `src/app/[locale]/quest/[id]/page.tsx`
- Modify: `src/components/quest/MissionDetail.tsx`

**Step 1: Add MissionChat to MissionDetail**

In `MissionDetail.tsx`, import and render `MissionChat` below the existing sections, but before `MissionActions`. Show it only when the mission is `in_progress`:

```tsx
{/* Mentor chat — only for in-progress missions */}
{isInProgress && questId && (
  <MissionChat
    questId={questId}
    missionId={mission.id}
    missionDay={mission.day}
    missionTitle={mission.title}
  />
)}
```

**Step 2: Verify build**

```bash
bun run build
```

**Step 3: Commit**

```bash
git add src/components/quest/ src/app/ && git commit -m "feat: integrate MissionChat into quest overview for in-progress missions"
```

---

### Task 16: ReflectionCard component

**Files:**
- Create: `src/components/quest/ReflectionCard.tsx`

**Step 1: Create the reflection component**

A simple card that appears after mission completion:
- Text area for reflection
- Optional voice recording button (reuse `AudioRecorder`)
- Submit button
- Success state with AI summary

**Step 2: Verify build**

```bash
bun run build
```

**Step 3: Commit**

```bash
git add src/components/quest/ReflectionCard.tsx && git commit -m "feat: add ReflectionCard component for daily mission reflections"
```

---

### Task 17: Final build verification

**Step 1: Full build**

```bash
bun run build
```

Expected: Build succeeds with no errors.

**Step 2: Seed the database**

```bash
bunx prisma db seed
```

Expected: Seed completes without errors.

**Step 3: Final commit (if any cleanup needed)**

---

## Summary of All New Files

| File | Purpose |
|------|---------|
| `prisma/migrations/*_add_mentor_system/migration.sql` | DB migration |
| `src/lib/ai/mentor-schemas.ts` | Zod schemas for mentor API |
| `src/lib/ai/mentor/chat.ts` | Claude Socratic mentor + simplification + reflection |
| `src/lib/ai/mentor/frustration.ts` | Rule-based frustration detection |
| `src/lib/ai/mentor/mock-chat.ts` | Mock mentor responses |
| `src/lib/ai/mentor/index.ts` | Barrel export |
| `src/app/api/mentor/session/route.ts` | GET/POST mentor sessions |
| `src/app/api/mentor/message/route.ts` | POST mentor messages |
| `src/app/api/mentor/adjust/route.ts` | POST mission adjustments |
| `src/app/api/reflection/daily/route.ts` | POST daily reflections |
| `src/components/quest/MissionChat.tsx` | Chat UI component |
| `src/components/quest/ReflectionCard.tsx` | Reflection UI component |

## Modified Files

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add 4 models + Mission relations |
| `prisma/seed.ts` | Add cleanup for new models |
| `src/app/api/quest/[id]/mission/[missionId]/route.ts` | Auto-create mentor session on start |
| `src/app/[locale]/quest/[id]/page.tsx` | (Minor: pass props for chat) |
| `src/components/quest/MissionDetail.tsx` | Add MissionChat integration |
| `messages/en.json` | Add `mentor` translation keys |
| `messages/id.json` | Add `mentor` translation keys |
| `messages/zh.json` | Add `mentor` translation keys |
