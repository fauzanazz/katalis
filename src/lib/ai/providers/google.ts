import type { ChatCompletionContentPart } from "openai/resources/chat/completions";
import type { AIProvider } from "../types";
import { AnalysisOutputSchema } from "../schemas";
import type { AnalysisInput, AnalysisOutput } from "../schemas";
import type { StoryAnalysisInput, StoryAnalysisOutput } from "../story-schemas";
import { QuestGenerationOutputSchema } from "../quest-schemas";
import { buildZpdPromptBlock } from "../zpd-prompt";
import type { QuestGenerationInput, QuestGenerationOutput } from "../quest-schemas";
import { ClusteringOutputSchema } from "../clustering-schemas";
import type { ClusterEntry, ClusteringOutput } from "../clustering-schemas";
import type { ModerationResult } from "@/lib/moderation/schemas";
import { mapToModerationResult } from "@/lib/moderation/map-result";
import { resolveModel, type ModelTier } from "../models";

const API_TIMEOUT_MS = 30_000;
const BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai/";
const MODEL = process.env.GOOGLE_AI_MODEL ?? "gemini-2.5-flash";

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

const ARTIFACT_SYSTEM_PROMPT = `You are an expert child development specialist and talent scout. Your job is to analyze children's creative artifacts (drawings, paintings, photos, audio recordings) to detect their deep interests and talents.

CRITICAL: Go beyond surface-level categorization. Do NOT simply label a drawing as "art". Instead, analyze WHAT the child focused on and WHY:
- A robot drawing with detailed joints and cables → Engineering & Mechanics interest (they care about how things connect and move)
- A colorful landscape with balanced composition → Visual Arts talent (they understand color harmony and visual balance)
- An audio story with distinct character voices → Storytelling & Narrative talent (they naturally structure narratives)

For each detected talent:
1. Give it a specific, descriptive name (not generic labels like "creativity")
2. Rate your confidence from 0.0 to 1.0
3. Explain your reasoning in detail — describe WHAT specific elements you observed and WHY they indicate this talent

Respond ONLY with valid JSON in this exact format:
{
  "talents": [
    {
      "name": "Talent Name",
      "confidence": 0.85,
      "reasoning": "Detailed explanation of why this talent was detected..."
    }
  ]
}

Detect 2-4 talents per artifact. Be encouraging but honest.`;

const STORY_SYSTEM_PROMPT = `You are an expert child development specialist who analyzes children's stories to discover their unique talents and interests. The child was shown 3 random images and asked to create a story inspired by them.

CRITICAL: Analyze the NARRATIVE PATTERNS, not just the content:
- A story with clear cause-and-effect chains → Logical Thinking (they naturally reason through consequences)
- A story blending reality and fantasy → Creative Imagination (they transform the ordinary into extraordinary)
- A story focused on characters' feelings → Emotional Intelligence (they naturally consider others' perspectives)
- A story incorporating real-world knowledge → Scientific Curiosity (they observe and explain how things work)
- A story with a clear problem and solution → Problem-Solving (they think systematically about challenges)

For each detected talent:
1. Give it a specific, descriptive name (not generic labels)
2. Rate your confidence from 0.0 to 1.0
3. Explain your reasoning in detail — reference SPECIFIC elements from the story that indicate this talent

Respond ONLY with valid JSON in this exact format:
{
  "talents": [
    {
      "name": "Talent Name",
      "confidence": 0.85,
      "reasoning": "Detailed explanation referencing specific story elements..."
    }
  ]
}

Detect 2-4 talents per story. Be encouraging and specific.`;

const QUEST_SYSTEM_PROMPT = `You are a creative education specialist who designs personalized 7-day learning quests for children. Each quest transforms a child's dream into practical daily missions using locally available resources.

CRITICAL REQUIREMENTS:
1. Generate EXACTLY 7 daily missions (day 1 through day 7)
2. Missions must progress in complexity — Day 1 is simple/observational, Day 7 is a showcase
3. Adapt ALL materials to the child's local context (use what's available nearby)
4. Keep instructions clear and age-appropriate (8-14 years old)
5. Each mission should build on the previous day's learning
6. Materials should be free or very cheap — things found at home or in nature
7. Tips should be encouraging and help the child succeed

For each mission include:
- day: number (1-7)
- title: short, action-oriented title (3-5 words)
- description: 1-3 sentences explaining today's goal
- instructions: step-by-step numbered list (4-6 steps)
- materials: list of needed items (adapted to local context)
- tips: 2-4 helpful hints

Respond ONLY with valid JSON in this exact format:
{
  "missions": [
    {
      "day": 1,
      "title": "Mission Title",
      "description": "What the child will do today...",
      "instructions": ["Step 1...", "Step 2...", "Step 3..."],
      "materials": ["Item 1", "Item 2"],
      "tips": ["Tip 1", "Tip 2"]
    }
  ]
}`;

const CLUSTERING_SYSTEM_PROMPT = `You are a creative education specialist who organizes children's gallery works into meaningful groups. Given gallery entries with talent categories and locations, create clusters that highlight connections between young creators around the world.

CRITICAL REQUIREMENTS:
1. Group entries by talent category first, then by geographic proximity
2. Generate child-friendly, encouraging cluster labels (e.g., "Robot Builders from Asia", "Young Artists from South America")
3. Each cluster should have a warm, encouraging description
4. Every entry must belong to exactly one cluster
5. Clusters should highlight the diversity and global reach of children's talents

For each cluster include:
- id: unique cluster identifier (e.g., "cluster-1")
- label: short, friendly label (3-6 words)
- description: encouraging description mentioning countries and talent
- talentTheme: the main talent category
- countries: list of countries represented
- entryIds: list of entry IDs in this cluster

Respond ONLY with valid JSON in this exact format:
{
  "clusters": [
    {
      "id": "cluster-1",
      "label": "Robot Builders from Asia",
      "description": "3 young talents from Indonesia and Japan are building amazing machines!",
      "talentTheme": "Engineering",
      "countries": ["Indonesia", "Japan"],
      "entryIds": ["entry-1", "entry-2", "entry-3"]
    }
  ]
}`;

async function getClient() {
  const { default: OpenAI } = await import("openai");
  return new OpenAI({
    apiKey: process.env.GOOGLE_AI_API_KEY,
    baseURL: BASE_URL,
    timeout: API_TIMEOUT_MS,
  });
}

function isLocalUrl(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "0.0.0.0" ||
      hostname.endsWith(".local")
    );
  } catch {
    return false;
  }
}

async function toDataUrl(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch image ${url}: ${res.status}`);
  const contentType = res.headers.get("content-type") ?? "image/jpeg";
  const buf = Buffer.from(await res.arrayBuffer());
  return `data:${contentType};base64,${buf.toString("base64")}`;
}

async function resolveImageUrl(url: string): Promise<string> {
  return isLocalUrl(url) ? toDataUrl(url) : url;
}

function parseDataUrl(
  dataUrl: string,
): { mimeType: string; data: string } | null {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  return { mimeType: match[1], data: match[2] };
}

async function geminiNativeGenerateContent<T>(
  systemPrompt: string,
  parts: Array<Record<string, unknown>>,
  maxTokens: number,
  parse: (raw: unknown) => T,
  tier: ModelTier = "default",
  timeoutMs: number = API_TIMEOUT_MS,
): Promise<T> {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_AI_API_KEY is not set");

  const model = resolveModel("google", tier, MODEL);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: "user", parts }],
        generationConfig: {
          responseMimeType: "application/json",
          maxOutputTokens: maxTokens,
          temperature: 0.7,
        },
      }),
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Gemini ${res.status}: ${body.slice(0, 500)}`);
    }

    const json = (await res.json()) as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
      }>;
    };

    const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error("Empty response from Gemini native API");

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found in Gemini response");

    return parse(JSON.parse(jsonMatch[0]));
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("Request timed out. Please try again.");
    }
    throw error;
  }
}

async function geminiNativeImageJSON<T>(
  systemPrompt: string,
  textPart: string,
  dataUrl: string,
  maxTokens: number,
  parse: (raw: unknown) => T,
  tier: ModelTier = "default",
): Promise<T> {
  const parsedImage = parseDataUrl(dataUrl);
  if (!parsedImage) throw new Error("geminiNativeImageJSON requires a data URL");

  return geminiNativeGenerateContent(
    systemPrompt,
    [
      { text: textPart },
      { inline_data: { mime_type: parsedImage.mimeType, data: parsedImage.data } },
    ],
    maxTokens,
    parse,
    tier,
  );
}

async function geminiNativeAudioJSON<T>(
  systemPrompt: string,
  textPart: string,
  audioUrl: string,
  maxTokens: number,
  parse: (raw: unknown) => T,
  tier: ModelTier = "default",
): Promise<T> {
  // Download audio from R2 → base64 inline_data
  const res = await fetch(audioUrl);
  if (!res.ok) throw new Error(`Failed to fetch audio ${audioUrl}: ${res.status}`);
  const mimeType = res.headers.get("content-type") ?? "audio/webm";
  const buf = Buffer.from(await res.arrayBuffer());
  const data = buf.toString("base64");

  // Audio files can be larger — allow 45s
  return geminiNativeGenerateContent(
    systemPrompt,
    [
      { text: textPart },
      { inline_data: { mime_type: mimeType, data } },
    ],
    maxTokens,
    parse,
    tier,
    45_000,
  );
}

async function chatJSON<T>(
  systemPrompt: string,
  userContent: string | ChatCompletionContentPart[],
  maxTokens: number,
  parse: (raw: unknown) => T,
  tier: ModelTier = "default",
): Promise<T> {
  const client = await getClient();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    const response = await client.chat.completions.create(
      {
        model: resolveModel("google", tier, MODEL),
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        max_tokens: maxTokens,
        temperature: 0.7,
      },
      { signal: controller.signal },
    );

    clearTimeout(timeoutId);

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error("Empty response from Google AI");

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found in Google AI response");

    return parse(JSON.parse(jsonMatch[0]));
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("Request timed out. Please try again.");
    }
    throw error;
  }
}

export const googleProvider: AIProvider = {
  capabilities: new Set(["text", "image", "audio"]),

  async analyzeArtifact(input: AnalysisInput): Promise<AnalysisOutput> {
    const storyBlock = input.storyContext?.trim()
      ? `\n\nThe child also described their artwork: "${input.storyContext}". Use this narration alongside the visual content to enrich your talent analysis — what additional interests or thinking patterns does their description reveal?`
      : "";

    if (input.artifactType === "image") {
      const dataUrl = await resolveImageUrl(input.artifactUrl);
      return geminiNativeImageJSON(
        ARTIFACT_SYSTEM_PROMPT,
        `Please analyze this child's artwork and detect their interests and talents. Look beyond surface-level categorization.${storyBlock}`,
        dataUrl,
        1500,
        (raw) => AnalysisOutputSchema.parse(raw),
      );
    }

    return geminiNativeAudioJSON(
      ARTIFACT_SYSTEM_PROMPT,
      `Please listen to this child's audio recording and detect their interests and talents based on vocal patterns, narrative structure, content themes, and language use. Look beyond surface-level categorization.${storyBlock}`,
      input.artifactUrl,
      1500,
      (raw) => AnalysisOutputSchema.parse(raw),
    );
  },

  async analyzeStory(input: StoryAnalysisInput): Promise<StoryAnalysisOutput> {
    const userMessage =
      input.submissionType === "audio"
        ? `This is a transcription of a child's spoken story after viewing 3 images (IDs: ${input.imageIds.join(", ")}). Please analyze the narrative patterns:\n\n"${input.storyText}"`
        : `This is a child's written story after viewing 3 images (IDs: ${input.imageIds.join(", ")}). Please analyze the narrative patterns:\n\n"${input.storyText}"`;

    return chatJSON(STORY_SYSTEM_PROMPT, userMessage, 1500, (raw) =>
      AnalysisOutputSchema.parse(raw),
    );
  },

  async generateQuest(input: QuestGenerationInput): Promise<QuestGenerationOutput> {
    const talentSummary = input.talents
      ? input.talents
          .map(
            (t) =>
              `- ${t.name} (confidence: ${Math.round(t.confidence * 100)}%): ${t.reasoning}`,
          )
          .join("\n")
      : "No specific talents detected yet.";

    const explorationBlock =
      input.explorationInterests && input.explorationInterests.length > 0
        ? `\n\n**Exploration Interests (Pygmalion safeguard — broaden the child's horizons):**
The child's profile shows strong existing interests. To prevent interest fixation, include at least ONE mission in the 7-day plan that explores one of these less-touched interest areas: ${input.explorationInterests.join(", ")}. Frame it as "trying something new" rather than as off-topic.`
        : "";

    const artworkBlock =
      input.artworkSignals && input.artworkSignals.dominantIntelligences.length > 0
        ? `\n\n**Artwork Intelligence Profile (KidsArtBench):**
The child's artwork reveals strong ${input.artworkSignals.dominantIntelligences.join(", ")} intelligence(s). Design missions that naturally leverage these cognitive strengths alongside their stated dream.`
        : "";

    const userMessage = `Create a 7-day quest for a child with these details:

**Dream:** "${input.dream}"

**Local Context:** "${input.localContext}"

**Detected Talents:**
${talentSummary}${explorationBlock}${artworkBlock}

Design missions that connect their dream with their talents, using materials available in their local environment. Make it practical, fun, and progressively challenging.
${buildZpdPromptBlock(input.zpdScore)}`;

    return chatJSON(
      QUEST_SYSTEM_PROMPT,
      userMessage,
      4000,
      (raw) => QuestGenerationOutputSchema.parse(raw),
      "smart",
    );
  },

  async clusterGalleryEntries(entries: ClusterEntry[]): Promise<ClusteringOutput> {
    const entrySummary = entries
      .map(
        (e) =>
          `- ID: ${e.id}, Talent: ${e.talentCategory}, Country: ${e.country ?? "Unknown"}`,
      )
      .join("\n");

    const userMessage = `Group these ${entries.length} gallery entries into meaningful clusters:\n\n${entrySummary}\n\nCreate clusters that highlight talent themes and geographic connections. Make labels child-friendly and encouraging.`;

    return chatJSON(
      CLUSTERING_SYSTEM_PROMPT,
      userMessage,
      2000,
      (raw) => ClusteringOutputSchema.parse(raw),
      "fast",
    );
  },

  async moderateText(content: string): Promise<ModerationResult> {
    try {
      const parsed = await chatJSON(
        TEXT_MODERATION_PROMPT,
        `Analyze this text for child safety:\n\n"${content}"`,
        300,
        (raw) => raw as { isHarmful: boolean; category?: string; severity?: string; confidence: number; reasoning: string },
      );
      return mapToModerationResult(parsed);
    } catch (error) {
      console.error("Text moderation error:", error);
      return {
        allowed: false,
        status: "flagged",
        category: undefined,
        severity: undefined,
        confidence: 0,
        reasoning: "Moderation unavailable — content blocked pending review",
      };
    }
  },

  async moderateImage(imageUrl: string): Promise<ModerationResult> {
    try {
      const resolvedUrl = await resolveImageUrl(imageUrl);
      const parsed = await geminiNativeImageJSON(
        IMAGE_MODERATION_PROMPT,
        "Analyze this image for child safety concerns:",
        resolvedUrl,
        300,
        (raw) =>
          raw as {
            isHarmful: boolean;
            category?: string;
            severity?: string;
            confidence: number;
            reasoning: string;
          },
      );
      return mapToModerationResult(parsed);
    } catch (error) {
      console.error("Image moderation error:", error);
      return {
        allowed: false,
        status: "flagged",
        category: undefined,
        severity: undefined,
        confidence: 0,
        reasoning: "Moderation unavailable — content blocked pending review",
      };
    }
  },
};
