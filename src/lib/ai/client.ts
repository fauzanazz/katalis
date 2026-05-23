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
import { fillPhaseMetadata } from "./zpd-prompt";
import { resolveImageToDataUrl } from "@/lib/storage/resolve-image";
import type { AnalysisInput, AnalysisOutput } from "./schemas";
import type { StoryAnalysisInput, StoryAnalysisOutput } from "./story-schemas";
import type { QuestGenerationInput, QuestGenerationOutput } from "./quest-schemas";
import type { ClusterEntry, ClusteringOutput } from "./clustering-schemas";

const isMock = () => process.env.USE_MOCK_AI === "true";

export async function analyzeArtifact(input: AnalysisInput): Promise<AnalysisOutput> {
  if (isMock()) return getMockMultimodalAnalysis(input.artifactType);
  const resolvedInput =
    input.artifactType === "image"
      ? { ...input, artifactUrl: await resolveImageToDataUrl(input.artifactUrl) }
      : input;
  return getProvider().analyzeArtifact(resolvedInput);
}

export async function analyzeStory(input: StoryAnalysisInput): Promise<StoryAnalysisOutput> {
  if (isMock()) return getMockStoryAnalysis(input.submissionType);
  return getProvider().analyzeStory(input);
}

export async function generateQuest(input: QuestGenerationInput): Promise<QuestGenerationOutput> {
  const raw = isMock()
    ? await getMockQuestGeneration(input.dream)
    : await getProvider().generateQuest(input);
  return fillPhaseMetadata(raw, input.zpdScore);
}

export async function clusterGalleryEntries(entries: ClusterEntry[]): Promise<ClusteringOutput> {
  if (isMock()) return getMockClustering(entries);
  return getProvider().clusterGalleryEntries(entries);
}
