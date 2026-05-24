import type { InterestKey, InterestSignalDimension } from "./taxonomy";
import { isInterestKey } from "./taxonomy";
import { mapToGardner } from "@/lib/ai/kidsartbench-schemas";
import type { KidsArtBenchScore } from "@/lib/ai/kidsartbench-schemas";

export type MappedInterestSignal = {
  interestKey: InterestKey;
  dimension: InterestSignalDimension;
  strength: number;
  confidence: number;
  metadataJson?: unknown;
};

type Talent = {
  name: string;
  confidence?: number;
  reasoning?: string;
};

const KEYWORD_MAP: Array<{ keywords: string[]; interestKey: InterestKey }> = [
  { keywords: ["science", "experiment", "chemistry", "biology", "physics", "lab"], interestKey: "science" },
  { keywords: ["animal", "pet", "dog", "cat", "bird", "fish", "wildlife", "creature"], interestKey: "animals" },
  { keywords: ["draw", "art", "paint", "color", "sketch", "craft", "creative"], interestKey: "art" },
  { keywords: ["build", "block", "lego", "construct", "engineer", "mechanic", "machine", "robot"], interestKey: "building" },
  { keywords: ["story", "character", "narrative", "tale", "fiction", "book", "write"], interestKey: "storytelling" },
  { keywords: ["space", "planet", "star", "galaxy", "cosmos", "astronaut", "universe"], interestKey: "space" },
  { keywords: ["move", "dance", "run", "jump", "gymnastic", "physical", "sport", "swim"], interestKey: "movement" },
  { keywords: ["music", "song", "rhythm", "melody", "instrument", "sing", "beat"], interestKey: "music" },
  { keywords: ["technology", "computer", "code", "program", "digital", "software", "app"], interestKey: "technology" },
  { keywords: ["nature", "plant", "outdoor", "garden", "tree", "environment", "forest"], interestKey: "nature" },
  { keywords: ["math", "number", "pattern", "count", "calculate", "logic", "puzzle"], interestKey: "math_patterns" },
  { keywords: ["cook", "bake", "food", "recipe", "kitchen", "meal"], interestKey: "cooking" },
  { keywords: ["help", "social", "community", "kind", "share", "volunteer", "care"], interestKey: "social_helping" },
  { keywords: ["lead", "organiz", "manage", "team", "direct", "captain"], interestKey: "leadership" },
  { keywords: ["collect", "gather", "sort", "catalog", "series"], interestKey: "collecting" },
  { keywords: ["pretend", "imagine", "role", "play", "fantasy", "make-believe"], interestKey: "pretend_play" },
  { keywords: ["read", "book", "librar", "literature", "story"], interestKey: "reading" },
  { keywords: ["water", "swim", "splash", "ocean", "river", "sea", "lake"], interestKey: "water_play" },
  { keywords: ["sport", "ball", "team", "game", "athletic", "compete", "match"], interestKey: "sports" },
  { keywords: ["machine", "engine", "gear", "mechanical", "motor", "vehicle"], interestKey: "machines" },
];

function matchesKeyword(text: string, keywords: string[]): boolean {
  const lower = text.toLowerCase();
  return keywords.some((kw) => lower.includes(kw));
}

function talentNameToInterestKey(name: string): InterestKey | null {
  const lower = name.toLowerCase();

  if (isInterestKey(lower)) return lower as InterestKey;

  for (const { keywords, interestKey } of KEYWORD_MAP) {
    if (matchesKeyword(lower, keywords)) return interestKey;
  }

  return null;
}

function extractTextFromAnalysis(analysis: unknown): string {
  if (!analysis || typeof analysis !== "object") return "";

  const obj = analysis as Record<string, unknown>;
  const parts: string[] = [];

  if (typeof obj["text"] === "string") parts.push(obj["text"]);
  if (typeof obj["description"] === "string") parts.push(obj["description"]);
  if (typeof obj["summary"] === "string") parts.push(obj["summary"]);

  return parts.join(" ");
}

const GARDNER_TO_INTEREST_KEYS: Partial<Record<string, InterestKey[]>> = {
  spatial:               ["art", "building", "space"],
  logical_mathematical:  ["math_patterns", "building", "technology"],
  visual_arts:           ["art"],
  naturalist:            ["nature", "animals"],
  linguistic:            ["storytelling", "reading"],
  intrapersonal:         ["storytelling"],
  interpersonal:         ["social_helping", "leadership"],
  bodily_kinesthetic:    ["movement", "sports"],
};

const KIDSARTBENCH_SIGNAL_THRESHOLD = 0.4;

/** Maps KidsArtBench 9-dim scores → Gardner intelligences → InterestSignals (dimension: "skill"). */
export function mapKidsArtBenchToInterestSignals(score: KidsArtBenchScore): MappedInterestSignal[] {
  const gardnerScores = mapToGardner(score);
  const signals: MappedInterestSignal[] = [];
  const seenKeys = new Set<InterestKey>();

  for (const [intelligence, gardnerScore] of Object.entries(gardnerScores)) {
    if (gardnerScore < KIDSARTBENCH_SIGNAL_THRESHOLD) continue;
    const interestKeys = GARDNER_TO_INTEREST_KEYS[intelligence];
    if (!interestKeys) continue;

    for (const interestKey of interestKeys) {
      if (seenKeys.has(interestKey)) continue;
      seenKeys.add(interestKey);
      signals.push({
        interestKey,
        dimension: "skill_growth",
        strength: Math.min(1, gardnerScore),
        confidence: Math.min(1, gardnerScore * 0.9),
        metadataJson: { source: "kidsartbench", intelligence, gardnerScore },
      });
    }
  }

  return signals;
}

export function mapDiscoveryAnalysisToInterestSignals(
  analysis: unknown,
  kidsArtBench?: KidsArtBenchScore,
): MappedInterestSignal[] {
  if (!analysis || typeof analysis !== "object") return [];

  const obj = analysis as Record<string, unknown>;
  const signals: MappedInterestSignal[] = [];
  const seenKeys = new Set<InterestKey>();

  // Process talents array (primary signal source)
  const talents = obj["talents"] ?? obj["detectedTalents"];
  if (Array.isArray(talents)) {
    for (const talent of talents as Talent[]) {
      if (!talent || typeof talent !== "object") continue;
      const name = typeof talent.name === "string" ? talent.name : "";
      const reasoning = typeof talent.reasoning === "string" ? talent.reasoning : "";
      const talentConfidence = typeof talent.confidence === "number" ? talent.confidence : 0.5;

      const combinedText = `${name} ${reasoning}`;

      for (const { keywords, interestKey } of KEYWORD_MAP) {
        if (seenKeys.has(interestKey)) continue;
        if (matchesKeyword(combinedText, keywords)) {
          seenKeys.add(interestKey);
          signals.push({
            interestKey,
            dimension: "engagement",
            strength: Math.min(1, 0.4 + talentConfidence * 0.6),
            confidence: talentConfidence,
            metadataJson: { talentName: name, reasoning },
          });
        }
      }

      // Also try direct name match
      const directKey = talentNameToInterestKey(name);
      if (directKey && !seenKeys.has(directKey)) {
        seenKeys.add(directKey);
        signals.push({
          interestKey: directKey,
          dimension: "engagement",
          strength: Math.min(1, 0.4 + talentConfidence * 0.6),
          confidence: talentConfidence,
          metadataJson: { talentName: name, reasoning },
        });
      }
    }
  }

  // Also scan any free text in analysis
  const freeText = extractTextFromAnalysis(obj["aiAnalysis"] ?? obj);
  if (freeText) {
    for (const { keywords, interestKey } of KEYWORD_MAP) {
      if (seenKeys.has(interestKey)) continue;
      if (matchesKeyword(freeText, keywords)) {
        seenKeys.add(interestKey);
        signals.push({
          interestKey,
          dimension: "curiosity",
          strength: 0.3,
          confidence: 0.4,
          metadataJson: { source: "free_text" },
        });
      }
    }
  }

  if (!kidsArtBench) return signals;

  // Merge kidsArtBench skill signals (higher confidence) with keyword signals
  const artBenchSignals = mapKidsArtBenchToInterestSignals(kidsArtBench);
  const artBenchKeys = new Set(artBenchSignals.map((s) => s.interestKey));
  // Only keep keyword signals for keys not covered by kidsArtBench
  const keywordOnly = signals.filter((s) => !artBenchKeys.has(s.interestKey));
  return [...artBenchSignals, ...keywordOnly];
}
