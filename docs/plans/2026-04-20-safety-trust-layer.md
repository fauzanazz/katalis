# Safety & Trust Layer — Sprint 1-2 (P0) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use parallel-plan-execution to implement this plan task-by-task.

**Goal:** Build an automated harmful-content moderation pipeline that protects children from inappropriate content in discovery, quest, and gallery flows — with positive redirection, AI uncertainty fallbacks, and an admin review queue.

**Architecture:** Three-layer moderation: (1) AI content classifier checks text/images before processing, (2) policy engine decides allow/block/flag with configurable thresholds, (3) persistence layer logs all moderation events for admin review. The system wraps existing AI calls transparently — API routes call `moderateContent()` before/after AI analysis.

**Tech Stack:** Prisma (ModerationEvent model), Zod (validation), OpenAI GPT-4o (image moderation), Claude (text moderation), next-intl (i18n), shadcn Dialog + Table (admin UI), lucide-react (icons)

---

## Session 1: Data Layer & Moderation Service

Tasks 1-4: Prisma model, migration, moderation service core, mock moderation
Exit criteria: `bun run build` passes, moderation service unit tests green

### Task 1: Add ModerationEvent Prisma Model

**Files:**
- Modify: `prisma/schema.prisma`

**Step 1: Add the ModerationEvent model to the Prisma schema**

Add after the `RateLimit` model:

```prisma
model ModerationEvent {
  id            String   @id @default(cuid())
  sourceType    String   // "discovery", "quest", "gallery", "flag"
  sourceId      String?  // ID of the related entity (discovery, quest, gallery entry)
  contentType   String   // "text", "image", "audio"
  contentHash   String?  // Hash of the content for dedup
  status        String   @default("pending") // "pending", "approved", "blocked", "flagged", "redirected"
  category      String?  // "violence", "self_harm", "sexual", "hate", "harassment", "spam", "other"
  severity      String?  // "low", "medium", "high", "critical"
  confidence    Float?   // AI confidence score for the moderation decision
  aiReasoning   String?  // AI explanation for the moderation decision
  childId       String?  // If applicable
  reviewerId    String?  // Admin user who reviewed
  reviewedAt    DateTime?
  metadata      String?  // JSON stored as text — additional context
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@index([sourceType, status])
  @@index([status, createdAt])
  @@index([childId])
}
```

**Step 2: Create the migration**

Run: `bunx prisma migrate dev --name add_moderation_event`
Expected: Migration created successfully, database updated

**Step 3: Regenerate Prisma client**

Run: `bunx prisma generate`
Expected: Prisma client regenerated with ModerationEvent model

**Step 4: Verify build passes**

Run: `bun run build`
Expected: Build succeeds

**Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add ModerationEvent model for content safety pipeline"
```

---

### Task 2: Create Moderation Schemas & Types

**Files:**
- Create: `src/lib/moderation/schemas.ts`

**Step 1: Create the moderation schemas file**

```typescript
/**
 * Zod schemas for content moderation input/output validation.
 */

import { z } from "zod";

/** Content types that can be moderated */
export const ContentTypeSchema = z.enum(["text", "image", "audio"]);
export type ContentType = z.infer<typeof ContentTypeSchema>;

/** Source types where content originates */
export const SourceTypeSchema = z.enum(["discovery", "quest", "gallery", "flag"]);
export type SourceType = z.infer<typeof SourceTypeSchema>;

/** Moderation statuses */
export const ModerationStatusSchema = z.enum([
  "pending",
  "approved",
  "blocked",
  "flagged",
  "redirected",
]);
export type ModerationStatus = z.infer<typeof ModerationStatusSchema>;

/** Harmful content categories */
export const HarmCategorySchema = z.enum([
  "violence",
  "self_harm",
  "sexual",
  "hate",
  "harassment",
  "spam",
  "other",
]);
export type HarmCategory = z.infer<typeof HarmCategorySchema>;

/** Severity levels */
export const SeveritySchema = z.enum(["low", "medium", "high", "critical"]);
export type Severity = z.infer<typeof SeveritySchema>;

/** Input for moderating content */
export const ModerationInputSchema = z.object({
  content: z.string().min(1, "Content is required"),
  contentType: ContentTypeSchema,
  sourceType: SourceTypeSchema,
  sourceId: z.string().optional(),
  childId: z.string().optional(),
});

export type ModerationInput = z.infer<typeof ModerationInputSchema>;

/** Result of a single moderation check */
export const ModerationResultSchema = z.object({
  allowed: z.boolean(),
  status: ModerationStatusSchema,
  category: HarmCategorySchema.optional(),
  severity: SeveritySchema.optional(),
  confidence: z.number().min(0).max(1).optional(),
  reasoning: z.string().optional(),
  redirectMessage: z.string().optional(),
});

export type ModerationResult = z.infer<typeof ModerationResultSchema>;

/** Image moderation input (URL-based) */
export const ImageModerationInputSchema = z.object({
  imageUrl: z.string().min(1, "Image URL is required"),
  sourceType: SourceTypeSchema,
  sourceId: z.string().optional(),
  childId: z.string().optional(),
});

export type ImageModerationInput = z.infer<typeof ImageModerationInputSchema>;
```

**Step 2: Verify build passes**

Run: `bun run build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/lib/moderation/schemas.ts
git commit -m "feat: add moderation schemas and types"
```

---

### Task 3: Create Moderation Policy Config

**Files:**
- Create: `src/lib/moderation/policy.ts`

**Step 1: Create the policy configuration**

```typescript
/**
 * Moderation policy configuration for child-safe content filtering.
 *
 * Defines thresholds, redirect messages, and severity mappings
 * that control how the moderation system responds to flagged content.
 */

import type { HarmCategory, Severity } from "./schemas";

/** Policy action for a moderation result */
export type PolicyAction = "allow" | "block" | "flag_for_review" | "redirect";

/** A policy rule that maps a harm category to an action */
export interface PolicyRule {
  category: HarmCategory;
  action: PolicyAction;
  minSeverity: Severity;
  confidenceThreshold: number; // Block only if AI confidence >= this
  redirectMessage: string;
}

/**
 * Age-safe moderation policy rules.
 *
 * These rules define how the system responds to each type of harmful content.
 * All rules default to the most protective action for children.
 */
const POLICY_RULES: PolicyRule[] = [
  {
    category: "violence",
    action: "block",
    minSeverity: "low",
    confidenceThreshold: 0.5,
    redirectMessage:
      "Let's create something amazing together! How about drawing something that makes you happy?",
  },
  {
    category: "self_harm",
    action: "block",
    minSeverity: "low",
    confidenceThreshold: 0.3,
    redirectMessage:
      "You matter and you're creative! Let's focus on something wonderful. How about a picture of your favorite place?",
  },
  {
    category: "sexual",
    action: "block",
    minSeverity: "low",
    confidenceThreshold: 0.3,
    redirectMessage:
      "Let's keep things fun and creative! Try drawing your favorite animal or a magical world.",
  },
  {
    category: "hate",
    action: "block",
    minSeverity: "low",
    confidenceThreshold: 0.4,
    redirectMessage:
      "Kindness is a superpower! Let's use your creativity for something positive. What makes you smile?",
  },
  {
    category: "harassment",
    action: "block",
    minSeverity: "low",
    confidenceThreshold: 0.5,
    redirectMessage:
      "Let's be kind to everyone! How about creating something that shows what friendship means to you?",
  },
  {
    category: "spam",
    action: "flag_for_review",
    minSeverity: "medium",
    confidenceThreshold: 0.6,
    redirectMessage: "",
  },
  {
    category: "other",
    action: "flag_for_review",
    minSeverity: "medium",
    confidenceThreshold: 0.7,
    redirectMessage: "",
  },
];

/**
 * Find the policy rule for a given harm category.
 */
export function getPolicyRule(category: HarmCategory): PolicyRule {
  return (
    POLICY_RULES.find((rule) => rule.category === category) ??
    POLICY_RULES[POLICY_RULES.length - 1] // fallback to "other" rule
  );
}

/**
 * Determine the action to take based on category, severity, and confidence.
 */
export function resolvePolicyAction(
  category: HarmCategory,
  severity: Severity,
  confidence: number,
): {
  action: PolicyAction;
  redirectMessage: string;
} {
  const rule = getPolicyRule(category);

  // If confidence is below threshold, just flag for review instead of blocking
  if (confidence < rule.confidenceThreshold) {
    return {
      action: "flag_for_review",
      redirectMessage: "",
    };
  }

  // Severity escalation: "critical" always blocks regardless of rule
  if (severity === "critical") {
    return {
      action: "block",
      redirectMessage: rule.redirectMessage,
    };
  }

  return {
    action: rule.action,
    redirectMessage: rule.redirectMessage,
  };
}

/**
 * Check if a severity level meets or exceeds a minimum threshold.
 * Order: low < medium < high < critical
 */
const SEVERITY_ORDER: Record<Severity, number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};

export function meetsSeverityThreshold(
  severity: Severity,
  minimum: Severity,
): boolean {
  return SEVERITY_ORDER[severity] >= SEVERITY_ORDER[minimum];
}

/**
 * Encouraging fallback messages when AI analysis confidence is low.
 * Used when the AI is uncertain about what the child submitted.
 */
export const UNCERTAINTY_FALLBACKS = [
  "What an interesting creation! We see something special in your work. Let's explore more to discover your unique talents!",
  "Your creation has us curious! There's something unique here. Let's try another activity to learn even more about your amazing abilities!",
  "That's a creative piece of work! We'd love to see more of what you can do. Keep creating and exploring!",
  "What a wonderful imagination you have! Let's discover even more about your creative talents through fun activities!",
] as const;

/**
 * Get a random encouraging fallback message for uncertain AI results.
 */
export function getUncertaintyFallback(): string {
  return UNCERTAINTY_FALLBACKS[
    Math.floor(Math.random() * UNCERTAINTY_FALLBACKS.length)
  ];
}
```

**Step 2: Verify build passes**

Run: `bun run build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/lib/moderation/policy.ts
git commit -m "feat: add moderation policy config with child-safe redirect messages"
```

---

### Task 4: Create Moderation Service Core

**Files:**
- Create: `src/lib/moderation/moderate-text.ts`
- Create: `src/lib/moderation/moderate-image.ts`
- Create: `src/lib/moderation/index.ts`
- Create: `src/lib/moderation/mock/moderation.ts`

**Step 1: Create the text moderation module**

`src/lib/moderation/moderate-text.ts`:

```typescript
/**
 * Text content moderation using Claude AI.
 *
 * Analyzes text for harmful content (violence, self-harm, hate speech, etc.)
 * and returns structured moderation results.
 */

import type { ModerationResult } from "./schemas";
import { resolvePolicyAction } from "./policy";
import { getMockTextModeration } from "./mock/moderation";

const MODERATION_TIMEOUT_MS = 15_000;

const TEXT_MODERATION_PROMPT = `You are a child safety content moderator. Analyze the following text content for any harmful, inappropriate, or unsafe material for children (ages 6-12).

Check for these categories:
- violence: Threats, graphic violence, weapons, fighting
- self_harm: Self-injury, depression, suicidal content
- sexual: Sexual content, inappropriate advances
- hate: Hate speech, discrimination, slurs
- harassment: Bullying, targeted harassment, intimidation
- spam: Repetitive, irrelevant, or promotional content
- other: Any other concerning content

Respond ONLY with valid JSON:
{
  "isHarmful": boolean,
  "category": "violence" | "self_harm" | "sexual" | "hate" | "harassment" | "spam" | "other" | null,
  "severity": "low" | "medium" | "high" | "critical" | null,
  "confidence": number (0.0-1.0),
  "reasoning": "Brief explanation of the decision"
}

Be CONSERVATIVE: when in doubt, flag for review rather than allowing. Children's safety is paramount.`;

export async function moderateText(content: string): Promise<ModerationResult> {
  if (process.env.USE_MOCK_AI === "true") {
    return getMockTextModeration(content);
  }

  return callClaudeForModeration(content);
}

async function callClaudeForModeration(
  content: string,
): Promise<ModerationResult> {
  const Anthropic = (await import("@anthropic-ai/sdk")).default;

  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    timeout: MODERATION_TIMEOUT_MS,
  });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), MODERATION_TIMEOUT_MS);

  try {
    const response = await client.messages.create(
      {
        model: "claude-sonnet-4-20250514",
        max_tokens: 300,
        system: TEXT_MODERATION_PROMPT,
        messages: [
          {
            role: "user",
            content: `Analyze this text for child safety:\n\n"${content}"`,
          },
        ],
      },
      { signal: controller.signal },
    );

    clearTimeout(timeoutId);

    const textBlock = response.content.find(
      (block: { type: string }) => block.type === "text",
    );
    if (!textBlock || textBlock.type !== "text") {
      // If we can't parse, flag for human review
      return {
        allowed: false,
        status: "flagged",
        category: "other",
        severity: "medium",
        confidence: 0,
        reasoning: "Moderation response could not be parsed",
      };
    }

    const parsed = JSON.parse(textBlock.text);
    return mapToModerationResult(parsed);
  } catch (error) {
    clearTimeout(timeoutId);

    // On error, allow content but flag for async review
    console.error("Text moderation error:", error);
    return {
      allowed: true,
      status: "flagged",
      category: undefined,
      severity: undefined,
      confidence: 0,
      reasoning: "Moderation failed, flagged for async review",
    };
  }
}

function mapToModerationResult(raw: {
  isHarmful: boolean;
  category: string | null;
  severity: string | null;
  confidence: number;
  reasoning: string;
}): ModerationResult {
  if (!raw.isHarmful) {
    return {
      allowed: true,
      status: "approved",
      confidence: raw.confidence,
      reasoning: raw.reasoning,
    };
  }

  const category = (raw.category ?? "other") as ModerationResult["category"];
  const severity = (raw.severity ?? "medium") as ModerationResult["severity"];

  const { action, redirectMessage } = resolvePolicyAction(
    category!,
    severity!,
    raw.confidence,
  );

  if (action === "block") {
    return {
      allowed: false,
      status: "blocked",
      category,
      severity,
      confidence: raw.confidence,
      reasoning: raw.reasoning,
      redirectMessage,
    };
  }

  if (action === "redirect") {
    return {
      allowed: false,
      status: "redirected",
      category,
      severity,
      confidence: raw.confidence,
      reasoning: raw.reasoning,
      redirectMessage,
    };
  }

  // flag_for_review — allow but log
  return {
    allowed: true,
    status: "flagged",
    category,
    severity,
    confidence: raw.confidence,
    reasoning: raw.reasoning,
  };
}
```

**Step 2: Create the image moderation module**

`src/lib/moderation/moderate-image.ts`:

```typescript
/**
 * Image content moderation using OpenAI GPT-4o.
 *
 * Analyzes images for harmful content before they are processed
 * for talent discovery or gallery submission.
 */

import type { ModerationResult } from "./schemas";
import { resolvePolicyAction } from "./policy";
import { getMockImageModeration } from "./mock/moderation";

const MODERATION_TIMEOUT_MS = 20_000;

const IMAGE_MODERATION_PROMPT = `You are a child safety image moderator. Analyze the provided image for any harmful, inappropriate, or unsafe content for children (ages 6-12).

Check for:
- violence: Graphic violence, weapons, fighting scenes
- self_harm: Self-injury imagery, concerning symbols
- sexual: Inappropriate or sexual content
- hate: Hate symbols, discriminatory imagery
- harassment: Bullying or targeting imagery
- other: Any other concerning visual content

Respond ONLY with valid JSON:
{
  "isHarmful": boolean,
  "category": "violence" | "self_harm" | "sexual" | "hate" | "harassment" | "other" | null,
  "severity": "low" | "medium" | "high" | "critical" | null,
  "confidence": number (0.0-1.0),
  "reasoning": "Brief explanation"
}

Be CONSERVATIVE: when in doubt, flag for review. Children's safety is paramount.`;

export async function moderateImage(imageUrl: string): Promise<ModerationResult> {
  if (process.env.USE_MOCK_AI === "true") {
    return getMockImageModeration(imageUrl);
  }

  return callOpenAIForImageModeration(imageUrl);
}

async function callOpenAIForImageModeration(
  imageUrl: string,
): Promise<ModerationResult> {
  const { default: OpenAI } = await import("openai");

  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    timeout: MODERATION_TIMEOUT_MS,
  });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), MODERATION_TIMEOUT_MS);

  try {
    const response = await client.chat.completions.create(
      {
        model: "gpt-4o",
        messages: [
          { role: "system", content: IMAGE_MODERATION_PROMPT },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Analyze this image for child safety concerns:",
              },
              {
                type: "image_url",
                image_url: { url: imageUrl },
              },
            ],
          },
        ],
        response_format: { type: "json_object" },
        max_tokens: 300,
        temperature: 0,
      },
      { signal: controller.signal },
    );

    clearTimeout(timeoutId);

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return {
        allowed: false,
        status: "flagged",
        category: "other",
        severity: "medium",
        confidence: 0,
        reasoning: "Moderation response was empty",
      };
    }

    const parsed = JSON.parse(content);
    return mapToModerationResult(parsed);
  } catch (error) {
    clearTimeout(timeoutId);

    console.error("Image moderation error:", error);
    return {
      allowed: true,
      status: "flagged",
      category: undefined,
      severity: undefined,
      confidence: 0,
      reasoning: "Moderation failed, flagged for async review",
    };
  }
}

function mapToModerationResult(raw: {
  isHarmful: boolean;
  category: string | null;
  severity: string | null;
  confidence: number;
  reasoning: string;
}): ModerationResult {
  if (!raw.isHarmful) {
    return {
      allowed: true,
      status: "approved",
      confidence: raw.confidence,
      reasoning: raw.reasoning,
    };
  }

  const category = (raw.category ?? "other") as ModerationResult["category"];
  const severity = (raw.severity ?? "medium") as ModerationResult["severity"];

  const { action, redirectMessage } = resolvePolicyAction(
    category!,
    severity!,
    raw.confidence,
  );

  if (action === "block") {
    return {
      allowed: false,
      status: "blocked",
      category,
      severity,
      confidence: raw.confidence,
      reasoning: raw.reasoning,
      redirectMessage,
    };
  }

  if (action === "redirect") {
    return {
      allowed: false,
      status: "redirected",
      category,
      severity,
      confidence: raw.confidence,
      reasoning: raw.reasoning,
      redirectMessage,
    };
  }

  return {
    allowed: true,
    status: "flagged",
    category,
    severity,
    confidence: raw.confidence,
    reasoning: raw.reasoning,
  };
}
```

**Step 3: Create the mock moderation module**

`src/lib/moderation/mock/moderation.ts`:

```typescript
/**
 * Mock moderation responses for development and testing.
 *
 * Always returns "safe" results in development mode,
 * but simulates realistic response times.
 */

import type { ModerationResult } from "../schemas";

/** Simulated safe result for text moderation */
export async function getMockTextModeration(
  _content: string,
): Promise<ModerationResult> {
  await new Promise((resolve) => setTimeout(resolve, 100 + Math.random() * 200));

  return {
    allowed: true,
    status: "approved",
    confidence: 0.98,
    reasoning: "Content appears safe for children",
  };
}

/** Simulated safe result for image moderation */
export async function getMockImageModeration(
  _imageUrl: string,
): Promise<ModerationResult> {
  await new Promise((resolve) => setTimeout(resolve, 200 + Math.random() * 300));

  return {
    allowed: true,
    status: "approved",
    confidence: 0.97,
    reasoning: "Image appears safe for children",
  };
}

/**
 * Mock that simulates detecting harmful content.
 * Only used in tests — not used in normal mock flow.
 */
export function getMockBlockedResult(
  category: string = "violence",
): ModerationResult {
  return {
    allowed: false,
    status: "blocked",
    category: category as ModerationResult["category"],
    severity: "high",
    confidence: 0.92,
    reasoning: `Mock: content flagged as ${category}`,
    redirectMessage:
      "Let's create something amazing together! How about drawing something that makes you happy?",
  };
}
```

**Step 4: Create the main moderation barrel export**

`src/lib/moderation/index.ts`:

```typescript
/**
 * Content moderation service for child safety.
 *
 * Provides a unified API for moderating text, images, and audio content.
 * Integrates with AI providers for harmful content detection and applies
 * policy rules to determine the appropriate action.
 */

import { prisma } from "@/lib/db";
import type {
  ModerationInput,
  ModerationResult,
  ImageModerationInput,
  ContentType,
  SourceType,
  ModerationStatus,
  HarmCategory,
  Severity,
} from "./schemas";
import { moderateText } from "./moderate-text";
import { moderateImage } from "./moderate-image";
import { getUncertaintyFallback } from "./policy";

/**
 * Moderate content and persist the result.
 *
 * This is the main entry point for content moderation.
 * It runs AI analysis, applies policy rules, and logs the event.
 */
export async function moderateContent(
  input: ModerationInput,
): Promise<ModerationResult & { eventId: string }> {
  const result = await runModeration(input.content, input.contentType);

  // Persist the moderation event
  const event = await prisma.moderationEvent.create({
    data: {
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      contentType: input.contentType,
      status: result.status,
      category: result.category,
      severity: result.severity,
      confidence: result.confidence,
      aiReasoning: result.reasoning,
      childId: input.childId,
      metadata: JSON.stringify({
        contentLength: input.content.length,
        contentType: input.contentType,
      }),
    },
  });

  return { ...result, eventId: event.id };
}

/**
 * Moderate an image by URL and persist the result.
 */
export async function moderateImageContent(
  input: ImageModerationInput,
): Promise<ModerationResult & { eventId: string }> {
  const result = await moderateImage(input.imageUrl);

  const event = await prisma.moderationEvent.create({
    data: {
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      contentType: "image",
      status: result.status,
      category: result.category,
      severity: result.severity,
      confidence: result.confidence,
      aiReasoning: result.reasoning,
      childId: input.childId,
      metadata: JSON.stringify({
        imageUrlLength: input.imageUrl.length,
      }),
    },
  });

  return { ...result, eventId: event.id };
}

/**
 * Run the appropriate moderation check based on content type.
 */
async function runModeration(
  content: string,
  contentType: ContentType,
): Promise<ModerationResult> {
  switch (contentType) {
    case "text":
      return moderateText(content);
    case "image":
      // For image URLs stored as text content
      return moderateImage(content);
    case "audio":
      // Audio moderation uses text moderation on any transcript
      // Full audio transcription is out of scope for Phase 2
      return moderateText(content);
    default:
      return {
        allowed: true,
        status: "flagged",
        reasoning: `Unknown content type: ${contentType}`,
      };
  }
}

/**
 * Get an encouraging fallback message for low-confidence AI results.
 */
export { getUncertaintyFallback } from "./policy";

// Re-export types and schemas
export type {
  ModerationInput,
  ModerationResult,
  ImageModerationInput,
  ContentType,
  SourceType,
  ModerationStatus,
  HarmCategory,
  Severity,
} from "./schemas";
export {
  ModerationInputSchema,
  ImageModerationInputSchema,
} from "./schemas";
```

**Step 5: Verify build passes**

Run: `bun run build`
Expected: Build succeeds

**Step 6: Commit**

```bash
git add src/lib/moderation/
git commit -m "feat: add moderation service with AI text/image analysis and policy engine"
```

---

## Session 2: Integration into API Routes

Tasks 5-7: Wire moderation into discovery, quest, gallery routes + upgrade flag endpoint
Exit criteria: `bun run build` passes, moderation integrated into all content-touching API routes

### Task 5: Integrate Moderation into Discovery Routes

**Files:**
- Modify: `src/app/api/discovery/analyze/route.ts`
- Modify: `src/app/api/discovery/analyze-story/route.ts`

**Step 1: Add image moderation to artifact analysis**

In `src/app/api/discovery/analyze/route.ts`, add the import and moderation check after URL validation (after line 48) and before AI analysis:

Add import at the top:
```typescript
import { moderateImageContent } from "@/lib/moderation";
```

After the Zod validation block and before the `// Run AI analysis` comment, insert:
```typescript
    // Moderate image content for child safety
    const moderationResult = await moderateImageContent({
      imageUrl: parsed.data.artifactUrl,
      sourceType: "discovery",
      childId: session.childId,
    });

    if (!moderationResult.allowed) {
      return NextResponse.json(
        {
          error: "content_blocked",
          message:
            moderationResult.redirectMessage ??
            "This content cannot be processed. Let's try something else!",
          redirect: true,
        },
        { status: 200 },
      );
    }
```

**Step 2: Add text moderation to story analysis**

In `src/app/api/discovery/analyze-story/route.ts`, add the import and moderation check:

Add import at the top:
```typescript
import { moderateContent } from "@/lib/moderation";
```

After the Zod validation block and before the `// Run Claude story analysis` comment, insert:
```typescript
    // Moderate story text for child safety
    const moderationResult = await moderateContent({
      content: parsed.data.storyText,
      contentType: "text",
      sourceType: "discovery",
      childId: session.childId,
    });

    if (!moderationResult.allowed) {
      return NextResponse.json(
        {
          error: "content_blocked",
          message:
            moderationResult.redirectMessage ??
            "This content cannot be processed. Let's try something else!",
          redirect: true,
        },
        { status: 200 },
      );
    }
```

**Step 3: Verify build passes**

Run: `bun run build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add src/app/api/discovery/
git commit -m "feat: integrate content moderation into discovery routes"
```

---

### Task 6: Integrate Moderation into Quest Generation

**Files:**
- Modify: `src/app/api/quest/generate/route.ts`

**Step 1: Add text moderation to quest generation**

In `src/app/api/quest/generate/route.ts`, add the import and moderation check:

Add import at the top:
```typescript
import { moderateContent } from "@/lib/moderation";
```

After the Zod validation block (after the `const { dream, localContext, ... }` destructuring) and before the discovery count check, insert:
```typescript
    // Moderate dream and context text for child safety
    const combinedText = `${dream} ${localContext}`;
    const moderationResult = await moderateContent({
      content: combinedText,
      contentType: "text",
      sourceType: "quest",
      childId: session.childId,
    });

    if (!moderationResult.allowed) {
      return NextResponse.json(
        {
          error: "content_blocked",
          message:
            moderationResult.redirectMessage ??
            "This content cannot be processed. Let's try something else!",
          redirect: true,
        },
        { status: 200 },
      );
    }
```

**Step 2: Verify build passes**

Run: `bun run build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/app/api/quest/generate/route.ts
git commit -m "feat: integrate content moderation into quest generation"
```

---

### Task 7: Upgrade Gallery Flag to Persist & Add Image Moderation to Gallery Submission

**Files:**
- Modify: `src/app/api/gallery/flag/route.ts`
- Modify: `src/app/api/gallery/entries/route.ts`

**Step 1: Upgrade flag endpoint to persist to ModerationEvent**

Replace the entire content of `src/app/api/gallery/flag/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sanitizeInput } from "@/lib/sanitize";
import { prisma } from "@/lib/db";

/**
 * POST /api/gallery/flag
 *
 * Content safety flag mechanism for gallery entries.
 * Persists flags to the ModerationEvent table for admin review.
 *
 * Publicly accessible — anyone can flag inappropriate content.
 */

const FlagSchema = z.object({
  entryId: z.string().min(1, "Entry ID is required"),
  reason: z.enum(["inappropriate", "offensive", "spam", "other"], {
    message: "Invalid flag reason",
  }),
  details: z.string().max(500).optional(),
});

/** Map user-facing flag reasons to moderation categories */
const REASON_TO_CATEGORY: Record<string, string> = {
  inappropriate: "sexual",
  offensive: "hate",
  spam: "spam",
  other: "other",
};

export async function POST(request: NextRequest | Request) {
  try {
    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json(
        { error: "invalid", message: "Invalid request body" },
        { status: 400 },
      );
    }

    const parsed = FlagSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "invalid",
          message: parsed.error.issues[0]?.message ?? "Invalid request",
        },
        { status: 400 },
      );
    }

    const { entryId, reason, details } = parsed.data;
    const sanitizedDetails = details ? sanitizeInput(details) : undefined;

    // Persist the flag to moderation events
    await prisma.moderationEvent.create({
      data: {
        sourceType: "flag",
        sourceId: entryId,
        contentType: "image",
        status: "flagged",
        category: REASON_TO_CATEGORY[reason] ?? "other",
        severity: reason === "inappropriate" ? "high" : "medium",
        metadata: JSON.stringify({
          reason,
          details: sanitizedDetails,
        }),
      },
    });

    return NextResponse.json({
      success: true,
      message: "Thank you for reporting. Our team will review this content.",
    });
  } catch (error) {
    console.error("Content flag error:", error);
    return NextResponse.json(
      { error: "server_error", message: "Failed to submit report" },
      { status: 500 },
    );
  }
}
```

**Step 2: Add image moderation to gallery submission**

In `src/app/api/gallery/entries/route.ts`, add import:
```typescript
import { moderateImageContent } from "@/lib/moderation";
```

After the duplicate check (after the `existingEntry` block) and before the talent extraction section, insert:
```typescript
    // Moderate the gallery photo for child safety
    const imageModeration = await moderateImageContent({
      imageUrl: photoUrl,
      sourceType: "gallery",
      sourceId: questId,
      childId: session.childId,
    });

    if (!imageModeration.allowed) {
      return NextResponse.json(
        {
          error: "content_blocked",
          message:
            imageModeration.redirectMessage ??
            "This image cannot be displayed publicly. Try a different photo!",
        },
        { status: 200 },
      );
    }
```

**Step 3: Verify build passes**

Run: `bun run build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add src/app/api/gallery/
git commit -m "feat: upgrade gallery flag to DB persistence and add image moderation to submissions"
```

---

## Session 3: Admin Moderation Queue & AI Fallback

Tasks 8-11: Admin moderation API, admin moderation UI, AI fallback integration, i18n
Exit criteria: `bun run build` passes, admin can review moderation events in dashboard

### Task 8: Create Admin Moderation API Routes

**Files:**
- Create: `src/app/api/admin/moderation/route.ts`
- Create: `src/app/api/admin/moderation/[id]/route.ts`

**Step 1: Create the moderation list/stats API**

`src/app/api/admin/moderation/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * GET /api/admin/moderation
 *
 * List moderation events with pagination and filtering.
 * Admin-only endpoint.
 *
 * Query params:
 * - page (default: 1)
 * - pageSize (default: 20, max: 100)
 * - status (filter by status)
 * - sourceType (filter by source type)
 */
export async function GET(request: NextRequest) {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json(
      { error: "unauthorized", message: "Admin access required" },
      { status: 401 },
    );
  }

  try {
    const url = new URL(request.url);
    const pageParam = parseInt(url.searchParams.get("page") || "1", 10);
    const pageSizeParam = parseInt(
      url.searchParams.get("pageSize") || "20",
      10,
    );
    const statusFilter = url.searchParams.get("status");
    const sourceTypeFilter = url.searchParams.get("sourceType");

    const page = Math.max(1, isNaN(pageParam) ? 1 : pageParam);
    const pageSize = Math.min(
      100,
      Math.max(1, isNaN(pageSizeParam) ? 20 : pageSizeParam),
    );
    const skip = (page - 1) * pageSize;

    const where: Record<string, unknown> = {};
    if (statusFilter) where.status = statusFilter;
    if (sourceTypeFilter) where.sourceType = sourceTypeFilter;

    const [events, total] = await Promise.all([
      prisma.moderationEvent.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: "desc" },
      }),
      prisma.moderationEvent.count({ where }),
    ]);

    // Get summary stats
    const [
      pendingCount,
      flaggedCount,
      blockedCount,
      approvedCount,
      totalEvents,
    ] = await Promise.all([
      prisma.moderationEvent.count({ where: { status: "pending" } }),
      prisma.moderationEvent.count({ where: { status: "flagged" } }),
      prisma.moderationEvent.count({ where: { status: "blocked" } }),
      prisma.moderationEvent.count({ where: { status: "approved" } }),
      prisma.moderationEvent.count(),
    ]);

    return NextResponse.json({
      events,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
      stats: {
        pending: pendingCount,
        flagged: flaggedCount,
        blocked: blockedCount,
        approved: approvedCount,
        total: totalEvents,
      },
    });
  } catch (error) {
    console.error("Moderation list error:", error);
    return NextResponse.json(
      { error: "server_error", message: "Failed to fetch moderation events" },
      { status: 500 },
    );
  }
}
```

**Step 2: Create the moderation review action API**

`src/app/api/admin/moderation/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * PATCH /api/admin/moderation/[id]
 *
 * Review a moderation event. Admin-only.
 *
 * Body: { action: "approve" | "block", notes?: string }
 */
const ReviewSchema = z.object({
  action: z.enum(["approve", "block"], {
    message: "Action must be 'approve' or 'block'",
  }),
  notes: z.string().max(1000).optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json(
      { error: "unauthorized", message: "Admin access required" },
      { status: 401 },
    );
  }

  try {
    const { id } = await params;
    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json(
        { error: "invalid", message: "Invalid request body" },
        { status: 400 },
      );
    }

    const parsed = ReviewSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "invalid",
          message: parsed.error.issues[0]?.message ?? "Invalid request",
        },
        { status: 400 },
      );
    }

    const { action, notes } = parsed.data;

    const event = await prisma.moderationEvent.findUnique({ where: { id } });
    if (!event) {
      return NextResponse.json(
        { error: "not_found", message: "Moderation event not found" },
        { status: 404 },
      );
    }

    const newStatus = action === "approve" ? "approved" : "blocked";

    const updated = await prisma.moderationEvent.update({
      where: { id },
      data: {
        status: newStatus,
        reviewerId: admin.userId,
        reviewedAt: new Date(),
        metadata: notes
          ? JSON.stringify({
              ...(event.metadata ? JSON.parse(event.metadata) : {}),
              reviewNotes: notes,
            })
          : event.metadata,
      },
    });

    return NextResponse.json({ success: true, event: updated });
  } catch (error) {
    console.error("Moderation review error:", error);
    return NextResponse.json(
      { error: "server_error", message: "Failed to review moderation event" },
      { status: 500 },
    );
  }
}
```

**Step 3: Verify build passes**

Run: `bun run build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add src/app/api/admin/moderation/
git commit -m "feat: add admin moderation API for listing and reviewing events"
```

---

### Task 9: Create Admin Moderation UI Page

**Files:**
- Create: `src/app/[locale]/admin/moderation/page.tsx`
- Create: `src/app/[locale]/admin/moderation/ReviewActions.tsx`
- Modify: `src/app/[locale]/admin/page.tsx` (add moderation link + stat)

**Step 1: Create the client-side review actions component**

`src/app/[locale]/admin/moderation/ReviewActions.tsx`:

```typescript
"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

interface ReviewActionsProps {
  eventId: string;
  onReviewed: () => void;
}

export function ReviewActions({ eventId, onReviewed }: ReviewActionsProps) {
  const t = useTranslations("admin.moderation");
  const [loading, setLoading] = useState(false);

  async function handleReview(action: "approve" | "block") {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/moderation/${eventId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      if (res.ok) {
        onReviewed();
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex gap-2">
      <Button
        size="sm"
        variant="outline"
        onClick={() => handleReview("approve")}
        disabled={loading}
      >
        {t("approve")}
      </Button>
      <Button
        size="sm"
        variant="destructive"
        onClick={() => handleReview("block")}
        disabled={loading}
      >
        {t("block")}
      </Button>
    </div>
  );
}
```

**Step 2: Create the admin moderation page**

`src/app/[locale]/admin/moderation/page.tsx`:

```typescript
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db";
import { Shield, AlertTriangle, CheckCircle, XCircle, Eye } from "lucide-react";
import { ReviewActions } from "./ReviewActions";

interface ModerationEvent {
  id: string;
  sourceType: string;
  sourceId: string | null;
  contentType: string;
  status: string;
  category: string | null;
  severity: string | null;
  confidence: number | null;
  aiReasoning: string | null;
  childId: string | null;
  reviewerId: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
}

interface ModerationStats {
  pending: number;
  flagged: number;
  blocked: number;
  approved: number;
  total: number;
}

async function getModerationData(
  statusFilter?: string,
): Promise<{ events: ModerationEvent[]; stats: ModerationStats }> {
  const where = statusFilter ? { status: statusFilter } : {};

  const [events, pending, flagged, blocked, approved, total] =
    await Promise.all([
      prisma.moderationEvent.findMany({
        where,
        take: 50,
        orderBy: { createdAt: "desc" },
      }),
      prisma.moderationEvent.count({ where: { status: "pending" } }),
      prisma.moderationEvent.count({ where: { status: "flagged" } }),
      prisma.moderationEvent.count({ where: { status: "blocked" } }),
      prisma.moderationEvent.count({ where: { status: "approved" } }),
      prisma.moderationEvent.count(),
    ]);

  return {
    events: events as ModerationEvent[],
    stats: { pending, flagged, blocked, approved, total },
  };
}

function StatusBadge({ status, t }: { status: string; t: (key: string) => string }) {
  const styles: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-800",
    flagged: "bg-orange-100 text-orange-800",
    blocked: "bg-red-100 text-red-800",
    approved: "bg-green-100 text-green-800",
    redirected: "bg-blue-100 text-blue-800",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${styles[status] ?? "bg-gray-100 text-gray-800"}`}
    >
      {t(`status_${status}`)}
    </span>
  );
}

function SeverityBadge({ severity }: { severity: string | null }) {
  if (!severity) return null;

  const styles: Record<string, string> = {
    low: "bg-blue-50 text-blue-700",
    medium: "bg-yellow-50 text-yellow-700",
    high: "bg-orange-50 text-orange-700",
    critical: "bg-red-50 text-red-700",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${styles[severity] ?? "bg-gray-50 text-gray-700"}`}
    >
      {severity}
    </span>
  );
}

export default async function AdminModerationPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const t = await getTranslations("admin.moderation");
  const params = await searchParams;
  const { events, stats } = await getModerationData(params.status);

  const statCards = [
    {
      key: "flagged",
      value: stats.flagged,
      icon: AlertTriangle,
      color: "text-orange-600",
    },
    {
      key: "pending",
      value: stats.pending,
      icon: Eye,
      color: "text-yellow-600",
    },
    {
      key: "blocked",
      value: stats.blocked,
      icon: XCircle,
      color: "text-red-600",
    },
    {
      key: "approved",
      value: stats.approved,
      icon: CheckCircle,
      color: "text-green-600",
    },
  ] as const;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      {/* Stats row */}
      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {statCards.map(({ key, value, icon: Icon, color }) => (
          <div
            key={key}
            className="rounded-xl border border-border/60 bg-background p-4"
          >
            <div className="flex items-center gap-2">
              <Icon className={`size-4 ${color}`} />
            </div>
            <p className="mt-2 text-2xl font-bold text-foreground">{value}</p>
            <p className="text-xs text-muted-foreground">{t(`stat_${key}`)}</p>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="mb-6 flex gap-2 overflow-x-auto">
        {["all", "flagged", "pending", "blocked", "approved"].map((filter) => (
          <a
            key={filter}
            href={`/admin/moderation${filter === "all" ? "" : `?status=${filter}`}`}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              (params.status ?? "all") === filter || (filter === "all" && !params.status)
                ? "bg-foreground text-background"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {t(`filter_${filter}`)}
          </a>
        ))}
      </div>

      {/* Events table */}
      {events.length === 0 ? (
        <div className="rounded-xl border border-border/60 bg-background p-8 text-center">
          <Shield className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">{t("empty")}</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border/60">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60 bg-muted/50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  {t("col_date")}
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  {t("col_source")}
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  {t("col_type")}
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  {t("col_status")}
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  {t("col_category")}
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  {t("col_severity")}
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  {t("col_reasoning")}
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  {t("col_actions")}
                </th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr
                  key={event.id}
                  className="border-b border-border/40 last:border-0"
                >
                  <td className="px-4 py-3 text-muted-foreground">
                    {event.createdAt.toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">{event.sourceType}</td>
                  <td className="px-4 py-3">{event.contentType}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={event.status} t={t} />
                  </td>
                  <td className="px-4 py-3">{event.category ?? "—"}</td>
                  <td className="px-4 py-3">
                    <SeverityBadge severity={event.severity} />
                  </td>
                  <td className="max-w-xs truncate px-4 py-3 text-muted-foreground">
                    {event.aiReasoning ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    {(event.status === "flagged" || event.status === "pending") && (
                      <ReviewActions eventId={event.id} onReviewed={() => {}} />
                    )}
                    {event.reviewedAt && (
                      <span className="text-xs text-muted-foreground">
                        ✓ {t("reviewed")}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
```

**Step 3: Add moderation link to admin dashboard**

In `src/app/[locale]/admin/page.tsx`, add import for ShieldAlert and add a moderation card:

Add import:
```typescript
import { Users, Shield, Ticket, Sparkles, Swords, Image, ShieldAlert } from "lucide-react";
```

In the `getStats` function, add:
```typescript
const pendingModeration = await prisma.moderationEvent.count({
  where: { status: { in: ["pending", "flagged"] } },
});
```

Add a moderation stat card to the `statCards` array:
```typescript
{ key: "pendingModeration" as const, value: pendingModeration, icon: ShieldAlert, color: "text-red-600" },
```

Add to the stats interface:
```typescript
pendingModeration: number;
```

Add a link card for moderation in the bottom grid (after the codes link):
```tsx
<Link
  href="/admin/moderation"
  className="rounded-xl border border-border/60 bg-background p-6 transition-colors hover:bg-zinc-50"
>
  <h2 className="font-semibold text-foreground">{t("tabs.moderation")}</h2>
  <p className="mt-1 text-sm text-muted-foreground">
    {pendingModeration} {t("stats.pendingModeration").toLowerCase()}
  </p>
</Link>
```

**Step 4: Verify build passes**

Run: `bun run build`
Expected: Build succeeds (may have minor type issues to fix)

**Step 5: Commit**

```bash
git add src/app/[locale]/admin/moderation/ src/app/[locale]/admin/page.tsx
git commit -m "feat: add admin moderation queue UI with review actions"
```

---

### Task 10: Add AI Uncertainty Fallback to Discovery Results

**Files:**
- Modify: `src/app/api/discovery/analyze/route.ts`
- Modify: `src/app/api/discovery/analyze-story/route.ts`

**Step 1: Add low-confidence fallback to artifact analysis**

In `src/app/api/discovery/analyze/route.ts`, add import:
```typescript
import { getUncertaintyFallback } from "@/lib/moderation";
```

After the AI analysis call (`const result = await analyzeArtifact(parsed.data)`), wrap with fallback:
```typescript
    // Run AI analysis
    let result = await analyzeArtifact(parsed.data);

    // If all talents have low confidence, add encouraging fallback
    const maxConfidence = Math.max(...result.talents.map((t) => t.confidence));
    if (maxConfidence < 0.5) {
      return NextResponse.json(
        {
          talents: result.talents,
          fallbackMessage: getUncertaintyFallback(),
          lowConfidence: true,
        },
        { status: 200 },
      );
    }
```

**Step 2: Add low-confidence fallback to story analysis**

In `src/app/api/discovery/analyze-story/route.ts`, add import:
```typescript
import { getUncertaintyFallback } from "@/lib/moderation";
```

After the AI analysis call (`const result = await analyzeStory(parsed.data)`), wrap with fallback:
```typescript
    // Run Claude story analysis
    let result = await analyzeStory(parsed.data);

    // If all talents have low confidence, add encouraging fallback
    const maxConfidence = Math.max(...result.talents.map((t) => t.confidence));
    if (maxConfidence < 0.5) {
      return NextResponse.json(
        {
          talents: result.talents,
          fallbackMessage: getUncertaintyFallback(),
          lowConfidence: true,
        },
        { status: 200 },
      );
    }
```

**Step 3: Verify build passes**

Run: `bun run build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add src/app/api/discovery/
git commit -m "feat: add AI uncertainty fallback with encouraging messages for low-confidence results"
```

---

### Task 11: Add i18n Translations for Moderation

**Files:**
- Modify: `messages/en.json`
- Modify: `messages/id.json`
- Modify: `messages/zh.json`

**Step 1: Add English translations**

Add to `messages/en.json` inside the `admin` object:

```json
"moderation": {
  "title": "Content Moderation",
  "subtitle": "Review flagged and blocked content",
  "empty": "No moderation events to review. All clear!",
  "approve": "Approve",
  "block": "Block",
  "reviewed": "Reviewed",
  "stat_flagged": "Flagged",
  "stat_pending": "Pending",
  "stat_blocked": "Blocked",
  "stat_approved": "Approved",
  "filter_all": "All",
  "filter_flagged": "Flagged",
  "filter_pending": "Pending",
  "filter_blocked": "Blocked",
  "filter_approved": "Approved",
  "status_pending": "Pending",
  "status_flagged": "Flagged",
  "status_blocked": "Blocked",
  "status_approved": "Approved",
  "status_redirected": "Redirected",
  "col_date": "Date",
  "col_source": "Source",
  "col_type": "Type",
  "col_status": "Status",
  "col_category": "Category",
  "col_severity": "Severity",
  "col_reasoning": "AI Reasoning",
  "col_actions": "Actions"
}
```

Also add to `admin.stats`:
```json
"pendingModeration": "Pending Review"
```

Also add to `admin.tabs`:
```json
"moderation": "Moderation"
```

Also add to `breadcrumb`:
```json
"moderation": "Moderation"
```

Also add to `discover.analysis`:
```json
"lowConfidence": "We're still learning about your unique talents! Keep creating and exploring — every piece helps us understand you better.",
"contentBlocked": "Let's try creating something different! How about drawing your favorite animal or a magical world?"
```

**Step 2: Add Indonesian translations**

Add corresponding translations to `messages/id.json`:

In `admin`:
```json
"moderation": {
  "title": "Moderasi Konten",
  "subtitle": "Tinjau konten yang ditandai dan diblokir",
  "empty": "Tidak ada peristiwa moderasi untuk ditinjau. Semua aman!",
  "approve": "Setujui",
  "block": "Blokir",
  "reviewed": "Ditinjau",
  "stat_flagged": "Ditandai",
  "stat_pending": "Menunggu",
  "stat_blocked": "Diblokir",
  "stat_approved": "Disetujui",
  "filter_all": "Semua",
  "filter_flagged": "Ditandai",
  "filter_pending": "Menunggu",
  "filter_blocked": "Diblokir",
  "filter_approved": "Disetujui",
  "status_pending": "Menunggu",
  "status_flagged": "Ditandai",
  "status_blocked": "Diblokir",
  "status_approved": "Disetujui",
  "status_redirected": "Dialihkan",
  "col_date": "Tanggal",
  "col_source": "Sumber",
  "col_type": "Tipe",
  "col_status": "Status",
  "col_category": "Kategori",
  "col_severity": "Tingkat",
  "col_reasoning": "Alasan AI",
  "col_actions": "Tindakan"
}
```

In `admin.stats`:
```json
"pendingModeration": "Menunggu Tinjauan"
```

In `admin.tabs`:
```json
"moderation": "Moderasi"
```

In `breadcrumb`:
```json
"moderation": "Moderasi"
```

In `discover.analysis`:
```json
"lowConfidence": "Kami masih mempelajari bakat unikmu! Teruslah berkarya dan menjelajah — setiap karyamu membantu kami mengenalmu lebih baik.",
"contentBlocked": "Ayo coba membuat sesuatu yang berbeda! Bagaimana kalau menggambar hewan favoritmu atau dunia ajaib?"
```

**Step 3: Add Chinese translations**

Add corresponding translations to `messages/zh.json`:

In `admin`:
```json
"moderation": {
  "title": "内容审核",
  "subtitle": "审核被标记和阻止的内容",
  "empty": "没有需要审核的事件。一切正常！",
  "approve": "批准",
  "block": "阻止",
  "reviewed": "已审核",
  "stat_flagged": "已标记",
  "stat_pending": "待处理",
  "stat_blocked": "已阻止",
  "stat_approved": "已批准",
  "filter_all": "全部",
  "filter_flagged": "已标记",
  "filter_pending": "待处理",
  "filter_blocked": "已阻止",
  "filter_approved": "已批准",
  "status_pending": "待处理",
  "status_flagged": "已标记",
  "status_blocked": "已阻止",
  "status_approved": "已批准",
  "status_redirected": "已重定向",
  "col_date": "日期",
  "col_source": "来源",
  "col_type": "类型",
  "col_status": "状态",
  "col_category": "类别",
  "col_severity": "严重性",
  "col_reasoning": "AI推理",
  "col_actions": "操作"
}
```

In `admin.stats`:
```json
"pendingModeration": "待审核"
```

In `admin.tabs`:
```json
"moderation": "审核"
```

In `breadcrumb`:
```json
"moderation": "审核"
```

In `discover.analysis`:
```json
"lowConfidence": "我们正在发现你独特的才能！继续创作和探索——每一件作品都能帮助我们更好地了解你。",
"contentBlocked": "让我们尝试创作不同的东西！画一幅你最喜欢的动物或魔法世界怎么样？"
```

**Step 4: Verify build passes**

Run: `bun run build`
Expected: Build succeeds

**Step 5: Commit**

```bash
git add messages/
git commit -m "feat: add i18n translations for moderation in en/id/zh"
```

---

## Session 4: Seed Update & Final Verification

Tasks 12-13: Update seed data, final build verification
Exit criteria: `bun run build` passes, seed runs cleanly, admin moderation page renders

### Task 12: Update Seed Script

**Files:**
- Modify: `prisma/seed.ts`

**Step 1: Add moderation event cleanup to seed**

In `prisma/seed.ts`, add `moderationEvent` to the cleanup/deleteMany section (it must come before any models it references). Add this line alongside the other deleteMany calls:

```typescript
await prisma.moderationEvent.deleteMany();
```

**Step 2: Verify seed runs**

Run: `bunx prisma db seed`
Expected: Seed runs without errors

**Step 3: Commit**

```bash
git add prisma/seed.ts
git commit -m "chore: add moderation event cleanup to seed script"
```

---

### Task 13: Final Build Verification & Integration Test

**Step 1: Run full build**

Run: `bun run build`
Expected: Build succeeds with no errors

**Step 2: Run seed to verify database integrity**

Run: `bunx prisma db seed`
Expected: Seed completes successfully

**Step 3: Verify typecheck passes**

Run: `bunx tsc --noEmit`
Expected: No type errors

**Step 4: Final commit if any fixes needed**

If any build/type issues were found and fixed:

```bash
git add -A
git commit -m "fix: resolve build issues from safety layer integration"
```

---

## Summary

| Session | Tasks | What's Built |
|---------|-------|--------------|
| 1 | 1-4 | Data model, moderation schemas, policy engine, AI moderation service |
| 2 | 5-7 | Moderation wired into discovery, quest, gallery API routes |
| 3 | 8-11 | Admin moderation API + UI, AI fallback messages, i18n |
| 4 | 12-13 | Seed update, final verification |

**Files created:** ~15 new files
**Files modified:** ~10 existing files
**New Prisma model:** `ModerationEvent`
**New API routes:** `GET /api/admin/moderation`, `PATCH /api/admin/moderation/[id]`
**New admin page:** `/admin/moderation`
