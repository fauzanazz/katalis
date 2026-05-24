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
import { getProvider, getImageProvider, getAudioProvider } from "./providers";
import { fillPhaseMetadata } from "./zpd-prompt";
import { resolveImageToDataUrl } from "@/lib/storage/resolve-image";
import { logProviderCall } from "@/lib/privacy/provider-audit";
import type { AnalysisInput, AnalysisOutput } from "./schemas";
import type { StoryAnalysisInput, StoryAnalysisOutput } from "./story-schemas";
import type { QuestGenerationInput, QuestGenerationOutput } from "./quest-schemas";
import type { ClusterEntry, ClusteringOutput } from "./clustering-schemas";

const isMock = () => process.env.USE_MOCK_AI === "true";

export async function analyzeArtifact(input: AnalysisInput): Promise<AnalysisOutput> {
  if (isMock()) return getMockMultimodalAnalysis(input.artifactType);
  if (input.artifactType === "image") {
    const dataUrl = await resolveImageToDataUrl(input.artifactUrl);
    logProviderCall({
      provider: process.env.AI_PROVIDER_IMAGE ?? process.env.AI_PROVIDER ?? "openai",
      artifactType: "image",
      operation: "analyze_artifact",
      byteSize: dataUrl.length,
      exifStripped: true,
    });
    const resolvedInput = { ...input, artifactUrl: dataUrl };
    return getImageProvider().analyzeArtifact(resolvedInput);
  }
  // audio — provider selected via AI_PROVIDER_AUDIO (falls back to AI_PROVIDER)
  logProviderCall({
    provider: process.env.AI_PROVIDER_AUDIO ?? process.env.AI_PROVIDER ?? "openai",
    artifactType: "audio",
    operation: "analyze_artifact",
  });
  return getAudioProvider().analyzeArtifact(input);
}

export async function analyzeStory(input: StoryAnalysisInput): Promise<StoryAnalysisOutput> {
  if (isMock()) return getMockStoryAnalysis(input.submissionType);
  logProviderCall({
    provider: process.env.AI_PROVIDER ?? "openai",
    artifactType: "story",
    operation: "analyze_story",
  });
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
