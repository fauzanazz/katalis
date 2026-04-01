/**
 * Mock multimodal analysis responses for development and testing.
 *
 * Provides 3+ variants reflecting different talent detection scenarios:
 * - Engineering talent (robot with joint/cable focus)
 * - Artistic talent (color/composition focus)
 * - Narrative talent (storytelling patterns from audio)
 *
 * Mock responses include detailed reasoning that goes beyond surface-level
 * analysis, explaining WHY a talent was detected.
 */

import type { AnalysisOutput } from "../schemas";

/** Engineering talent mock — e.g., a child drew a robot with mechanical details */
const engineeringTalentResponse: AnalysisOutput = {
  talents: [
    {
      name: "Engineering & Mechanics",
      confidence: 0.92,
      reasoning:
        "The drawing shows remarkable attention to mechanical details — the robot's joints are depicted with distinct pivot points and the cables connecting limbs follow realistic routing patterns. Rather than drawing a simple cartoon robot, this child focused on how the parts connect and move together, suggesting a strong intuitive understanding of mechanical systems and structural engineering principles.",
    },
    {
      name: "Spatial Reasoning",
      confidence: 0.78,
      reasoning:
        "The proportions of the robot's body parts are consistent and the perspective is maintained throughout the drawing. The child demonstrated an ability to visualize three-dimensional objects on a two-dimensional surface, placing components in spatially logical positions relative to each other.",
    },
    {
      name: "Problem Solving",
      confidence: 0.65,
      reasoning:
        "Several design elements suggest the child was thinking about functional challenges — the placement of sensors near the head, the reinforced leg structure for stability, and the articulated fingers designed for gripping. These choices reflect an analytical mindset focused on solving real-world problems through design.",
    },
  ],
};

/** Artistic talent mock — e.g., a colorful painting with expressive composition */
const artisticTalentResponse: AnalysisOutput = {
  talents: [
    {
      name: "Visual Arts & Composition",
      confidence: 0.89,
      reasoning:
        "The artwork demonstrates an unusually sophisticated sense of color harmony — the warm oranges and cool blues are balanced in a way that creates visual depth and emotional warmth. The composition follows an intuitive rule of thirds, with the main subject positioned to draw the eye naturally across the canvas. This suggests a natural artistic eye that understands visual balance.",
    },
    {
      name: "Emotional Expression",
      confidence: 0.82,
      reasoning:
        "The choice of vivid, contrasting colors and the dynamic brush strokes convey a strong emotional narrative. The way light falls across the scene creates a mood of wonder and curiosity. This child uses color and form as tools for emotional communication, going beyond simple representation to express feelings.",
    },
    {
      name: "Creative Imagination",
      confidence: 0.75,
      reasoning:
        "The scene combines real-world elements with fantastical additions — realistic trees alongside floating lanterns and imaginary creatures. This blending of reality and imagination shows a creative mind that doesn't just copy what is seen, but actively transforms and reimagines the world.",
    },
  ],
};

/** Narrative talent mock — e.g., an audio recording with storytelling patterns */
const narrativeTalentResponse: AnalysisOutput = {
  talents: [
    {
      name: "Storytelling & Narrative",
      confidence: 0.88,
      reasoning:
        "The audio recording reveals a natural storytelling ability — the child structures their narrative with a clear beginning, rising tension, and resolution. They use vocal variation to distinguish between characters and build suspense. The pacing shows an intuitive understanding of how to hold a listener's attention.",
    },
    {
      name: "Vocal Expression",
      confidence: 0.79,
      reasoning:
        "The child demonstrates impressive vocal range and control, using pitch changes, pauses, and emphasis to bring their story to life. Different characters are given distinct vocal qualities, showing an awareness of how voice can create personality and emotion. This suggests talent in performance and communication.",
    },
    {
      name: "Empathy & Emotional Intelligence",
      confidence: 0.71,
      reasoning:
        "The story's characters experience a range of emotions — joy, fear, determination — and the child accurately conveys these through both narrative description and vocal performance. The way the protagonist helps a friend in need suggests the child naturally thinks about others' feelings and perspectives.",
    },
  ],
};

/** All mock response variants indexed for rotation */
const mockResponses: AnalysisOutput[] = [
  engineeringTalentResponse,
  artisticTalentResponse,
  narrativeTalentResponse,
];

/**
 * Get a mock analysis response.
 *
 * Selects a response variant based on the artifact type:
 * - "audio" always returns the narrative talent response
 * - "image" rotates between engineering and artistic talent responses
 *
 * Adds a small artificial delay to simulate real API latency.
 */
export async function getMockMultimodalAnalysis(
  artifactType: "image" | "audio",
): Promise<AnalysisOutput> {
  // Simulate API latency (800–1500ms)
  const delay = 800 + Math.random() * 700;
  await new Promise((resolve) => setTimeout(resolve, delay));

  if (artifactType === "audio") {
    return narrativeTalentResponse;
  }

  // For images, rotate between engineering and artistic based on timestamp
  const index = Date.now() % 2 === 0 ? 0 : 1;
  return mockResponses[index];
}

/** Exported for direct testing of individual responses */
export const mockVariants = {
  engineering: engineeringTalentResponse,
  artistic: artisticTalentResponse,
  narrative: narrativeTalentResponse,
} as const;
