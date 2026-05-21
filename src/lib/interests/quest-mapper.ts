import type { InterestKey, InterestSignalDimension } from "./taxonomy";
import { isInterestKey } from "./taxonomy";

export type MappedInterestSignal = {
  interestKey: InterestKey;
  dimension: InterestSignalDimension;
  strength: number;
  confidence: number;
  metadataJson?: unknown;
};

type Talent = { name: string; confidence?: number };

const KEYWORD_MAP: Array<{ keywords: string[]; interestKey: InterestKey }> = [
  { keywords: ["science", "experiment", "chemistry", "biology", "physics", "lab"], interestKey: "science" },
  { keywords: ["animal", "pet", "dog", "cat", "bird", "fish", "wildlife"], interestKey: "animals" },
  { keywords: ["draw", "art", "paint", "color", "sketch", "craft", "creative"], interestKey: "art" },
  { keywords: ["build", "block", "lego", "construct", "engineer", "mechanic"], interestKey: "building" },
  { keywords: ["story", "character", "narrative", "tale", "fiction", "write"], interestKey: "storytelling" },
  { keywords: ["space", "planet", "star", "galaxy", "cosmos", "astronaut"], interestKey: "space" },
  { keywords: ["move", "dance", "run", "jump", "gymnastic", "physical"], interestKey: "movement" },
  { keywords: ["music", "song", "rhythm", "melody", "instrument", "sing"], interestKey: "music" },
  { keywords: ["technology", "computer", "code", "program", "digital", "robot"], interestKey: "technology" },
  { keywords: ["nature", "plant", "outdoor", "garden", "tree", "environment"], interestKey: "nature" },
  { keywords: ["math", "number", "pattern", "count", "calculate", "logic"], interestKey: "math_patterns" },
  { keywords: ["cook", "bake", "food", "recipe", "kitchen"], interestKey: "cooking" },
  { keywords: ["help", "social", "community", "kind", "share", "care"], interestKey: "social_helping" },
  { keywords: ["lead", "organiz", "manage", "team", "captain"], interestKey: "leadership" },
  { keywords: ["collect", "gather", "sort", "catalog", "series"], interestKey: "collecting" },
  { keywords: ["pretend", "imagine", "role", "play", "fantasy"], interestKey: "pretend_play" },
  { keywords: ["read", "librar", "literature"], interestKey: "reading" },
  { keywords: ["water", "swim", "splash", "ocean", "river", "sea", "lake"], interestKey: "water_play" },
  { keywords: ["sport", "ball", "team", "game", "athletic", "compete"], interestKey: "sports" },
  { keywords: ["machine", "engine", "gear", "mechanical", "motor", "vehicle"], interestKey: "machines" },
];

function matchesKeyword(text: string, keywords: string[]): boolean {
  const lower = text.toLowerCase();
  return keywords.some((kw) => lower.includes(kw));
}

function extractInterestKeysFromText(text: string): InterestKey[] {
  const found: InterestKey[] = [];
  const seen = new Set<InterestKey>();
  for (const { keywords, interestKey } of KEYWORD_MAP) {
    if (!seen.has(interestKey) && matchesKeyword(text, keywords)) {
      seen.add(interestKey);
      found.push(interestKey);
    }
  }
  return found;
}

function extractTalents(obj: Record<string, unknown>): Talent[] {
  const raw = obj["talents"] ?? obj["detectedTalents"];
  if (!Array.isArray(raw)) return [];
  return raw.filter((t): t is Talent => typeof t === "object" && t !== null);
}

function buildQuestText(quest: Record<string, unknown>): string {
  const parts: string[] = [];
  if (typeof quest["dream"] === "string") parts.push(quest["dream"]);
  if (typeof quest["localContext"] === "string") parts.push(quest["localContext"]);
  if (typeof quest["description"] === "string") parts.push(quest["description"]);

  const talents = extractTalents(quest);
  for (const t of talents) {
    if (typeof t.name === "string") parts.push(t.name);
  }

  return parts.join(" ");
}

export function mapQuestToInterestSignals(quest: unknown): MappedInterestSignal[] {
  if (!quest || typeof quest !== "object") return [];

  const obj = quest as Record<string, unknown>;
  const text = buildQuestText(obj);
  if (!text.trim()) return [];

  const keys = extractInterestKeysFromText(text);

  const talents = extractTalents(obj);
  const talentKeyMap = new Map<InterestKey, number>();
  for (const talent of talents) {
    if (typeof talent.name !== "string") continue;
    const talentText = talent.name;
    for (const { keywords, interestKey } of KEYWORD_MAP) {
      if (matchesKeyword(talentText, keywords)) {
        const existing = talentKeyMap.get(interestKey) ?? 0;
        talentKeyMap.set(interestKey, Math.max(existing, talent.confidence ?? 0.5));
      }
    }
  }

  return keys.map((interestKey) => {
    const talentConf = talentKeyMap.get(interestKey);
    return {
      interestKey,
      dimension: "curiosity" as InterestSignalDimension,
      strength: 0.25,
      confidence: talentConf !== undefined ? talentConf : 0.5,
    };
  });
}

type ReflectionEntry = { text?: string; feeling?: string };

export function mapMissionCompletionToInterestSignals(input: {
  quest?: unknown;
  mission?: unknown;
  reflection?: unknown;
}): MappedInterestSignal[] {
  const { quest, mission, reflection } = input;
  const textParts: string[] = [];

  if (quest && typeof quest === "object") {
    const q = quest as Record<string, unknown>;
    if (typeof q["dream"] === "string") textParts.push(q["dream"]);
    if (typeof q["localContext"] === "string") textParts.push(q["localContext"]);
    const talents = extractTalents(q);
    for (const t of talents) {
      if (typeof t.name === "string") textParts.push(t.name);
    }
  }

  if (mission && typeof mission === "object") {
    const m = mission as Record<string, unknown>;
    if (typeof m["title"] === "string") textParts.push(m["title"]);
    if (typeof m["description"] === "string") textParts.push(m["description"]);
  }

  if (reflection && typeof reflection === "object") {
    const r = reflection as ReflectionEntry;
    if (typeof r.text === "string") textParts.push(r.text);
    if (typeof r.feeling === "string") textParts.push(r.feeling);
  } else if (typeof reflection === "string") {
    textParts.push(reflection);
  }

  const text = textParts.join(" ");
  if (!text.trim()) return [];

  const keys = extractInterestKeysFromText(text);
  return keys.map((interestKey) => ({
    interestKey,
    dimension: "engagement" as InterestSignalDimension,
    strength: 0.6,
    confidence: 0.7,
  }));
}

export { isInterestKey };
