/**
 * Mock story analysis responses for development and testing.
 *
 * Provides deterministic responses for Claude narrative analysis of children's stories.
 * Each response detects talents from narrative patterns, referencing elements
 * of the story structure, vocabulary, and creative choices.
 *
 * Variants:
 * - Logical thinker: child who writes structured, cause-and-effect narratives
 * - Creative storyteller: child who writes imaginative, fantastical stories
 * - Empathetic narrator: child who focuses on character feelings and relationships
 * - Scientific explorer: child who incorporates real-world knowledge and curiosity
 */

import type { AnalysisOutput } from "../schemas";

/** Logical thinking talent — structured narrative with cause and effect */
const logicalThinkerResponse: AnalysisOutput = {
  talents: [
    {
      name: "Logical Thinking & Problem Solving",
      confidence: 0.91,
      reasoning:
        "The story follows a clear cause-and-effect structure — when the character encounters an obstacle, they systematically evaluate options before choosing a solution. The narrative includes step-by-step reasoning ('first they checked the map, then counted the supplies, and finally decided on the shortest path'), revealing a naturally analytical mindset that enjoys breaking problems into smaller, manageable parts.",
    },
    {
      name: "Strategic Planning",
      confidence: 0.82,
      reasoning:
        "The child's story demonstrates forward thinking — the main character prepares tools and considers potential challenges before embarking on the journey. This anticipatory planning in the narrative suggests the child naturally thinks ahead and considers consequences, a key trait in strategic reasoning.",
    },
    {
      name: "Clear Communication",
      confidence: 0.68,
      reasoning:
        "The story is told in a well-organized sequence with transitions like 'because of this' and 'that's why'. The child uses precise language to describe events, showing an ability to communicate complex ideas in an orderly and understandable way.",
    },
  ],
};

/** Creative storyteller — imaginative narrative with fantastical elements */
const creativeStorytellerResponse: AnalysisOutput = {
  talents: [
    {
      name: "Creative Imagination",
      confidence: 0.94,
      reasoning:
        "The story blends real-world elements with extraordinary inventions — talking animals build a rainbow bridge using songs, clouds become trampolines, and flowers whisper secrets. This seamless mixing of reality and fantasy shows a richly imaginative mind that doesn't just describe the world but actively reimagines and transforms it into something magical.",
    },
    {
      name: "Storytelling & Narrative Design",
      confidence: 0.85,
      reasoning:
        "The narrative has a satisfying arc — it begins with a mystery (who stole the colors?), builds tension through the quest, and resolves with an unexpected twist (the colors were hiding to surprise everyone). The child instinctively understands story structure and knows how to keep a reader engaged through pacing and surprise.",
    },
    {
      name: "Artistic Sensibility",
      confidence: 0.72,
      reasoning:
        "The story is rich with sensory descriptions — 'the sky turned cotton-candy pink', 'the river sounded like a soft lullaby', 'the ground felt like warm chocolate cake'. This attention to colors, sounds, and textures suggests a strong aesthetic awareness and ability to paint vivid pictures with words.",
    },
  ],
};

/** Empathetic narrator — focus on feelings and relationships */
const empatheticNarratorResponse: AnalysisOutput = {
  talents: [
    {
      name: "Empathy & Emotional Intelligence",
      confidence: 0.93,
      reasoning:
        "The story centers on how characters feel — when the little bird is lost, the child describes not just the situation but the bird's loneliness, fear, and hope. The protagonist helps not because of a reward, but because 'nobody should feel alone'. This deep attention to emotional states shows remarkable empathy and understanding of others' perspectives.",
    },
    {
      name: "Social Understanding",
      confidence: 0.84,
      reasoning:
        "The narrative explores relationships and group dynamics — characters have different opinions but find a way to cooperate. The child describes how the shy turtle slowly gained confidence because the other animals listened patiently. This nuanced understanding of social interactions suggests natural leadership and conflict-resolution abilities.",
    },
    {
      name: "Expressive Language",
      confidence: 0.76,
      reasoning:
        "The child uses emotionally rich vocabulary — 'her heart felt like a warm blanket', 'his smile could light up the whole forest'. These metaphors for emotions show an advanced ability to articulate feelings, a talent valuable in writing, counseling, and any field requiring emotional communication.",
    },
  ],
};

/** Scientific explorer — incorporates real-world knowledge */
const scientificExplorerResponse: AnalysisOutput = {
  talents: [
    {
      name: "Scientific Curiosity",
      confidence: 0.90,
      reasoning:
        "The story is filled with real-world observations woven into the narrative — the character notices that plants grow toward sunlight, that heavy things sink in water, and that mixing colors creates new ones. The child naturally incorporates cause-and-effect observations from the physical world, showing a scientific mindset driven by curiosity about how things work.",
    },
    {
      name: "Observational Skills",
      confidence: 0.83,
      reasoning:
        "The narrative includes remarkably detailed descriptions of the environment — noticing patterns in leaf shapes, counting the rings on a tree stump, and describing how shadows change throughout the day. This attention to detail and pattern recognition suggests strong observational abilities essential for scientific inquiry.",
    },
    {
      name: "Inventive Thinking",
      confidence: 0.71,
      reasoning:
        "When faced with a problem in the story, the character invents creative solutions using materials from nature — building a raft from logs and vines, using a large leaf as an umbrella, creating a pulley from branches. This combines practical knowledge with creative problem-solving, suggesting a natural inventor's mindset.",
    },
  ],
};

/** All mock response variants */

/**
 * Get a mock story analysis response.
 *
 * Selects a response variant based on submission type:
 * - "audio" always returns empathetic narrator (audio stories tend to be
 *   more emotionally expressive)
 * - "text" rotates between logical thinker, creative storyteller, and
 *   scientific explorer based on timestamp
 *
 * Adds artificial delay to simulate real API latency.
 */
export async function getMockStoryAnalysis(
  submissionType: "text" | "audio",
): Promise<AnalysisOutput> {
  // Simulate API latency (1000–2000ms)
  const delay = 1000 + Math.random() * 1000;
  await new Promise((resolve) => setTimeout(resolve, delay));

  if (submissionType === "audio") {
    return empatheticNarratorResponse;
  }

  // For text, rotate between logical, creative, and scientific
  const textVariants = [
    logicalThinkerResponse,
    creativeStorytellerResponse,
    scientificExplorerResponse,
  ];
  const index = Date.now() % 3;
  return textVariants[index];
}

/** Exported for direct testing of individual responses */
export const storyMockVariants = {
  logical: logicalThinkerResponse,
  creative: creativeStorytellerResponse,
  empathetic: empatheticNarratorResponse,
  scientific: scientificExplorerResponse,
} as const;
