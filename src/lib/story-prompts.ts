/**
 * Curated story prompt images for the story prompting discovery flow.
 *
 * Each image is a simple, age-appropriate SVG illustration stored locally
 * in public/story-prompts/. The system selects 3 random images from this
 * set to present to the child as story starters.
 */

export interface StoryPromptImage {
  id: string;
  src: string;
  altEn: string;
  altId: string;
  altZh: string;
}

/** Full set of curated story prompt images */
export const STORY_PROMPT_IMAGES: StoryPromptImage[] = [
  {
    id: "forest-adventure",
    src: "/story-prompts/forest-adventure.svg",
    altEn: "A colorful forest with tall trees, sunshine, and little creatures",
    altId: "Hutan berwarna-warni dengan pohon tinggi, sinar matahari, dan makhluk kecil",
    altZh: "色彩斑斓的森林，有高大的树木、阳光和小动物",
  },
  {
    id: "ocean-discovery",
    src: "/story-prompts/ocean-discovery.svg",
    altEn: "An ocean scene with a friendly fish, seaweed, and sunshine",
    altId: "Pemandangan laut dengan ikan ramah, rumput laut, dan sinar matahari",
    altZh: "海洋场景，有友好的鱼、海藻和阳光",
  },
  {
    id: "space-journey",
    src: "/story-prompts/space-journey.svg",
    altEn: "A space scene with a rocket, planets, moon, and stars",
    altId: "Pemandangan luar angkasa dengan roket, planet, bulan, dan bintang",
    altZh: "太空场景，有火箭、行星、月亮和星星",
  },
  {
    id: "magical-garden",
    src: "/story-prompts/magical-garden.svg",
    altEn: "A magical garden with colorful flowers and sparkling lights",
    altId: "Taman ajaib dengan bunga berwarna-warni dan cahaya berkilau",
    altZh: "魔法花园，有五彩缤纷的花朵和闪烁的灯光",
  },
  {
    id: "city-builders",
    src: "/story-prompts/city-builders.svg",
    altEn: "A cheerful city with colorful buildings and a bright sun",
    altId: "Kota ceria dengan gedung berwarna-warni dan matahari cerah",
    altZh: "快乐的城市，有色彩缤纷的建筑和明亮的太阳",
  },
  {
    id: "animal-friends",
    src: "/story-prompts/animal-friends.svg",
    altEn: "Friendly animals including a bear, cat, and bird in a sunny meadow",
    altId: "Hewan-hewan ramah termasuk beruang, kucing, dan burung di padang rumput cerah",
    altZh: "友好的动物，包括熊、猫和鸟，在阳光明媚的草地上",
  },
  {
    id: "rainy-day",
    src: "/story-prompts/rainy-day.svg",
    altEn: "A rainy day scene with an umbrella, puddles, and rain clouds",
    altId: "Pemandangan hari hujan dengan payung, genangan, dan awan hujan",
    altZh: "雨天的场景，有雨伞、水坑和乌云",
  },
  {
    id: "mountain-explorer",
    src: "/story-prompts/mountain-explorer.svg",
    altEn: "Mountain landscape with snow-capped peaks, trees, and sunshine",
    altId: "Pemandangan gunung dengan puncak bersalju, pohon, dan sinar matahari",
    altZh: "雪山风景，有白雪覆盖的山峰、树木和阳光",
  },
  {
    id: "treasure-map",
    src: "/story-prompts/treasure-map.svg",
    altEn: "An old treasure map with a path, chest, compass, and island",
    altId: "Peta harta karun tua dengan jalur, peti, kompas, dan pulau",
    altZh: "古老的藏宝图，有路径、宝箱、指南针和岛屿",
  },
];

/**
 * Select N random images from the curated set.
 * Uses Fisher-Yates shuffle to ensure randomness.
 */
export function getRandomStoryPrompts(count: number = 3): StoryPromptImage[] {
  const shuffled = [...STORY_PROMPT_IMAGES];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, Math.min(count, shuffled.length));
}
