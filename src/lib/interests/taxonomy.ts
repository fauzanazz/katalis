export const INTEREST_TAXONOMY_VERSION = "v1" as const;

export const INTEREST_TAXONOMY_V1 = [
  "nature",
  "animals",
  "space",
  "building",
  "machines",
  "art",
  "music",
  "storytelling",
  "movement",
  "sports",
  "cooking",
  "science",
  "math_patterns",
  "social_helping",
  "leadership",
  "collecting",
  "pretend_play",
  "technology",
  "reading",
  "water_play",
] as const;

export const INTEREST_SIGNAL_SOURCES = [
  "discovery_analysis",
  "quest_started",
  "quest_completed",
  "mission_completed",
  "reflection",
  "gallery_entry",
  "explicit_child_rating",
  "explicit_parent_rating",
  "parent_follow_feedback",
  "ai_parent_report",
] as const;

export const INTEREST_SIGNAL_DIMENSIONS = [
  "engagement",
  "persistence",
  "joy",
  "curiosity",
  "independence",
  "repeat_request",
  "skill_growth",
  "frustration",
] as const;

export type InterestKey = (typeof INTEREST_TAXONOMY_V1)[number];
export type InterestSignalSource = (typeof INTEREST_SIGNAL_SOURCES)[number];
export type InterestSignalDimension = (typeof INTEREST_SIGNAL_DIMENSIONS)[number];

const interestKeys = new Set<string>(INTEREST_TAXONOMY_V1);
const interestSignalSources = new Set<string>(INTEREST_SIGNAL_SOURCES);
const interestSignalDimensions = new Set<string>(INTEREST_SIGNAL_DIMENSIONS);

export function isInterestKey(value: string): value is InterestKey {
  return interestKeys.has(value);
}

export function assertInterestKey(value: string): asserts value is InterestKey {
  if (!isInterestKey(value)) throw new Error(`Unknown interest key: ${value}`);
}

export function isInterestSignalSource(value: string): value is InterestSignalSource {
  return interestSignalSources.has(value);
}

export function isInterestSignalDimension(value: string): value is InterestSignalDimension {
  return interestSignalDimensions.has(value);
}

export function assertInterestSignalDimension(
  value: string,
): asserts value is InterestSignalDimension {
  if (!isInterestSignalDimension(value))
    throw new Error(`Unknown interest signal dimension: ${value}`);
}
