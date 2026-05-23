import type { AnalysisInput, AnalysisOutput } from "./schemas";
import type { StoryAnalysisInput, StoryAnalysisOutput } from "./story-schemas";
import type { QuestGenerationInput, QuestGenerationOutput } from "./quest-schemas";
import type { ClusterEntry, ClusteringOutput } from "./clustering-schemas";
import type { ModerationResult } from "@/lib/moderation/schemas";

/**
 * Modalities a provider natively supports.
 * - "image" → can process image bytes/data URLs (not just URLs as text)
 * - "audio" → can process audio bytes inline (not just URL strings as text)
 * - "text"  → text-only generation (always assumed true)
 */
export type ProviderModality = "text" | "image" | "audio";

export interface AIProvider {
  /** Modalities this provider natively handles. Defaults to ["text"] if absent. */
  readonly capabilities?: ReadonlySet<ProviderModality>;

  analyzeArtifact(input: AnalysisInput): Promise<AnalysisOutput>;
  analyzeStory(input: StoryAnalysisInput): Promise<StoryAnalysisOutput>;
  generateQuest(input: QuestGenerationInput): Promise<QuestGenerationOutput>;
  clusterGalleryEntries(entries: ClusterEntry[]): Promise<ClusteringOutput>;
  moderateText(content: string): Promise<ModerationResult>;
  moderateImage(imageUrl: string): Promise<ModerationResult>;
}
