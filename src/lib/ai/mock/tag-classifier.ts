/**
 * Mock multi-tag classifier for development.
 * Maps talent categories to deterministic sub-tags with fixed confidence.
 */

import type { TagClassificationOutput } from "../tag-schemas";

const CATEGORY_TAGS: Record<string, Array<{ name: string; confidence: number; category: string }>> = {
  Engineering: [
    { name: "Mechanical Design", confidence: 0.9, category: "Engineering" },
    { name: "Problem Solving", confidence: 0.85, category: "Engineering" },
    { name: "Robotics", confidence: 0.8, category: "Engineering" },
    { name: "Creative Building", confidence: 0.75, category: "Creative" },
  ],
  Art: [
    { name: "Visual Arts", confidence: 0.92, category: "Art" },
    { name: "Color Theory", confidence: 0.8, category: "Art" },
    { name: "Creative Expression", confidence: 0.85, category: "Creative" },
    { name: "Design Thinking", confidence: 0.7, category: "Creative" },
  ],
  Narrative: [
    { name: "Storytelling", confidence: 0.88, category: "Narrative" },
    { name: "Creative Writing", confidence: 0.82, category: "Narrative" },
    { name: "Imagination", confidence: 0.78, category: "Creative" },
  ],
  Music: [
    { name: "Rhythm", confidence: 0.85, category: "Music" },
    { name: "Musical Composition", confidence: 0.8, category: "Music" },
    { name: "Performance", confidence: 0.75, category: "Music" },
  ],
  Science: [
    { name: "Scientific Inquiry", confidence: 0.9, category: "Science" },
    { name: "Experimentation", confidence: 0.85, category: "Science" },
    { name: "Curiosity", confidence: 0.8, category: "Science" },
  ],
};

const DEFAULT_TAGS = [
  { name: "Creativity", confidence: 0.7, category: "Creative" },
  { name: "Exploration", confidence: 0.65, category: "Creative" },
];

export async function getMockTagClassification(
  talentCategory: string,
  questContext?: string,
): Promise<TagClassificationOutput> {
  await new Promise((resolve) => setTimeout(resolve, 300 + Math.random() * 400));

  const tags = CATEGORY_TAGS[talentCategory] ?? DEFAULT_TAGS;
  return { tags: tags.slice(0, 4) };
}
