/**
 * Provider-agnostic AI client.
 *
 * Pick a provider with AI_PROVIDER env var: "openai" (default) | "anthropic"
 * Short-circuit to mocks with USE_MOCK_AI=true.
 */

import { getMockMultimodalAnalysis } from "./mock/multimodal-analysis";
import { getMockStoryAnalysis } from "./mock/story-analysis";
import { getMockQuestGeneration } from "./mock/quest-generation";
import { getMockClustering } from "./mock/clustering";
import { getProvider } from "./providers";
import type { AnalysisInput, AnalysisOutput } from "./schemas";
import type { StoryAnalysisInput, StoryAnalysisOutput } from "./story-schemas";
import type { QuestGenerationInput, QuestGenerationOutput } from "./quest-schemas";
import type { ClusterEntry, ClusteringOutput } from "./clustering-schemas";

const isMock = () => process.env.USE_MOCK_AI === "true";

export async function analyzeArtifact(input: AnalysisInput): Promise<AnalysisOutput> {
  if (isMock()) return getMockMultimodalAnalysis(input.artifactType);
  return getProvider().analyzeArtifact(input);
}

export async function analyzeStory(input: StoryAnalysisInput): Promise<StoryAnalysisOutput> {
  if (isMock()) return getMockStoryAnalysis(input.submissionType);
  return getProvider().analyzeStory(input);
}

export async function generateQuest(input: QuestGenerationInput): Promise<QuestGenerationOutput> {
  if (isMock()) return getMockQuestGeneration(input.dream);
  return getProvider().generateQuest(input);
}

export async function clusterGalleryEntries(entries: ClusterEntry[]): Promise<ClusteringOutput> {
  if (isMock()) return getMockClustering(entries);
  return getProvider().clusterGalleryEntries(entries);
}
