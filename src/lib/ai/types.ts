import type { AnalysisInput, AnalysisOutput } from "./schemas";
import type { StoryAnalysisInput, StoryAnalysisOutput } from "./story-schemas";
import type { QuestGenerationInput, QuestGenerationOutput } from "./quest-schemas";
import type { ClusterEntry, ClusteringOutput } from "./clustering-schemas";

export interface AIProvider {
  analyzeArtifact(input: AnalysisInput): Promise<AnalysisOutput>;
  analyzeStory(input: StoryAnalysisInput): Promise<StoryAnalysisOutput>;
  generateQuest(input: QuestGenerationInput): Promise<QuestGenerationOutput>;
  clusterGalleryEntries(entries: ClusterEntry[]): Promise<ClusteringOutput>;
}
