import type { ChatCompletionContentPart } from "openai/resources/chat/completions";
import type { AIProvider } from "../types";
import { AnalysisOutputSchema } from "../schemas";
import type { AnalysisInput, AnalysisOutput } from "../schemas";
import type { StoryAnalysisInput, StoryAnalysisOutput } from "../story-schemas";
import { QuestGenerationOutputSchema } from "../quest-schemas";
import type { QuestGenerationInput, QuestGenerationOutput } from "../quest-schemas";
import { ClusteringOutputSchema } from "../clustering-schemas";
import type { ClusterEntry, ClusteringOutput } from "../clustering-schemas";
import type { ModerationResult } from "@/lib/moderation/schemas";
import { mapToModerationResult } from "@/lib/moderation/map-result";

const API_TIMEOUT_MS = 30_000;
const BASE_URL = "https://integrate.api.nvidia.com/v1";
const TEXT_MODEL = "meta/llama-3.1-70b-instruct";
const VISION_MODEL = "meta/llama-3.2-90b-vision-instruct";

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
    apiKey: process.env.NVIDIA_API_KEY,
    baseURL: BASE_URL,
    timeout: API_TIMEOUT_MS,
  });
}

async function chatJSON<T>(
  systemPrompt: string,
  userContent: string | ChatCompletionContentPart[],
  maxTokens: number,
  parse: (raw: unknown) => T,
  model: string,
): Promise<T> {
  const client = await getClient();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    const response = await client.chat.completions.create(
      {
        model,
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
    if (!content) throw new Error("Empty response from NVIDIA NIM");

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found in NVIDIA NIM response");

    return parse(JSON.parse(jsonMatch[0]));
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("Request timed out. Please try again.");
    }
    throw error;
  }
}

export const nvidiaProvider: AIProvider = {
  async analyzeArtifact(input: AnalysisInput): Promise<AnalysisOutput> {
    const userContent =
      input.artifactType === "image"
        ? [
            {
              type: "text" as const,
              text: "Please analyze this child's artwork and detect their interests and talents. Look beyond surface-level categorization.",
            },
            { type: "image_url" as const, image_url: { url: input.artifactUrl } },
          ]
        : [
            {
              type: "text" as const,
              text: `Please analyze this child's audio recording (available at: ${input.artifactUrl}) and detect their interests and talents based on vocal patterns, narrative structure, and content themes. Look beyond surface-level categorization.`,
            },
          ];

    const model = input.artifactType === "image" ? VISION_MODEL : TEXT_MODEL;
    return chatJSON(ARTIFACT_SYSTEM_PROMPT, userContent, 1500, (raw) =>
      AnalysisOutputSchema.parse(raw),
    model);
  },

  async analyzeStory(input: StoryAnalysisInput): Promise<StoryAnalysisOutput> {
    const userMessage =
      input.submissionType === "audio"
        ? `This is a transcription of a child's spoken story after viewing 3 images (IDs: ${input.imageIds.join(", ")}). Please analyze the narrative patterns:\n\n"${input.storyText}"`
        : `This is a child's written story after viewing 3 images (IDs: ${input.imageIds.join(", ")}). Please analyze the narrative patterns:\n\n"${input.storyText}"`;

    return chatJSON(STORY_SYSTEM_PROMPT, userMessage, 1500, (raw) =>
      AnalysisOutputSchema.parse(raw),
    TEXT_MODEL);
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

    const userMessage = `Create a 7-day quest for a child with these details:

**Dream:** "${input.dream}"

**Local Context:** "${input.localContext}"

**Detected Talents:**
${talentSummary}

Design missions that connect their dream with their talents, using materials available in their local environment. Make it practical, fun, and progressively challenging.`;

    return chatJSON(QUEST_SYSTEM_PROMPT, userMessage, 4000, (raw) =>
      QuestGenerationOutputSchema.parse(raw),
    TEXT_MODEL);
  },

  async clusterGalleryEntries(entries: ClusterEntry[]): Promise<ClusteringOutput> {
    const entrySummary = entries
      .map(
        (e) =>
          `- ID: ${e.id}, Talent: ${e.talentCategory}, Country: ${e.country ?? "Unknown"}`,
      )
      .join("\n");

    const userMessage = `Group these ${entries.length} gallery entries into meaningful clusters:\n\n${entrySummary}\n\nCreate clusters that highlight talent themes and geographic connections. Make labels child-friendly and encouraging.`;

    return chatJSON(CLUSTERING_SYSTEM_PROMPT, userMessage, 2000, (raw) =>
      ClusteringOutputSchema.parse(raw),
    TEXT_MODEL);
  },

  async moderateText(content: string): Promise<ModerationResult> {
    try {
      const parsed = await chatJSON(
        TEXT_MODERATION_PROMPT,
        `Analyze this text for child safety:\n\n"${content}"`,
        300,
        (raw) => raw as { isHarmful: boolean; category?: string; severity?: string; confidence: number; reasoning: string },
        TEXT_MODEL,
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
      const userContent: ChatCompletionContentPart[] = [
        { type: "text", text: "Analyze this image for child safety concerns:" },
        { type: "image_url", image_url: { url: imageUrl } },
      ];
      const parsed = await chatJSON(
        IMAGE_MODERATION_PROMPT,
        userContent,
        300,
        (raw) => raw as { isHarmful: boolean; category?: string; severity?: string; confidence: number; reasoning: string },
        VISION_MODEL,
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
