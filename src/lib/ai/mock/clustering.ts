/**
 * Mock AI clustering responses for development and testing.
 *
 * Groups gallery entries by talent category and geographic proximity,
 * generating meaningful, child-friendly cluster labels.
 *
 * The mock implements deterministic clustering logic:
 * 1. Group entries by talent category
 * 2. Within each group, sub-group by geographic region
 * 3. Generate descriptive, child-friendly labels
 */

import type { ClusterEntry, ClusteringOutput, Cluster } from "../clustering-schemas";

/**
 * Geographic regions for grouping countries.
 */
const REGION_MAP: Record<string, string> = {
  Indonesia: "Asia",
  Japan: "Asia",
  China: "Asia",
  India: "Asia",
  Thailand: "Asia",
  Vietnam: "Asia",
  Malaysia: "Asia",
  Philippines: "Asia",
  Korea: "Asia",
  "South Korea": "Asia",
  Singapore: "Asia",
  Brazil: "South America",
  Argentina: "South America",
  Colombia: "South America",
  Chile: "South America",
  Peru: "South America",
  Mexico: "North America",
  "United States": "North America",
  Canada: "North America",
  Germany: "Europe",
  France: "Europe",
  "United Kingdom": "Europe",
  Spain: "Europe",
  Italy: "Europe",
  Netherlands: "Europe",
  Nigeria: "Africa",
  Kenya: "Africa",
  "South Africa": "Africa",
  Egypt: "Africa",
  Ghana: "Africa",
  Australia: "Oceania",
  "New Zealand": "Oceania",
};

function getRegion(country: string | null): string {
  if (!country) return "Around the World";
  return REGION_MAP[country] ?? "Around the World";
}

/**
 * Generate a child-friendly cluster label based on talent theme and countries.
 */
function generateClusterLabel(
  talentTheme: string,
  countries: string[],
  region: string,
): string {
  const talentLabels: Record<string, string> = {
    Engineering: "Robot Builders",
    "Engineering/Mekanika": "Robot Builders",
    Art: "Young Artists",
    "Art/Seni Visual": "Young Artists",
    Narrative: "Story Tellers",
    "Narrative/Storytelling": "Story Tellers",
    Storytelling: "Story Tellers",
    Creative: "Creative Minds",
    Music: "Music Makers",
    Science: "Science Explorers",
    Leadership: "Young Leaders",
    Empathy: "Kind Hearts",
  };

  const friendlyTalent = talentLabels[talentTheme] ?? "Talented Kids";

  if (countries.length === 1) {
    return `${friendlyTalent} from ${countries[0]}`;
  }
  if (region !== "Around the World") {
    return `${friendlyTalent} from ${region}`;
  }
  return `${friendlyTalent} from Around the World`;
}

/**
 * Generate a child-friendly cluster description.
 */
function generateClusterDescription(
  talentTheme: string,
  countries: string[],
  entryCount: number,
): string {
  const countryList =
    countries.length <= 3
      ? countries.join(", ")
      : `${countries.slice(0, 3).join(", ")} and more`;

  const talentDescriptions: Record<string, string> = {
    Engineering: "building amazing machines and solving engineering challenges",
    "Engineering/Mekanika": "building amazing machines and solving engineering challenges",
    Art: "creating beautiful artwork and expressing their creativity through colors",
    "Art/Seni Visual": "creating beautiful artwork and expressing their creativity through colors",
    Narrative: "telling wonderful stories and sharing their imagination",
    "Narrative/Storytelling": "telling wonderful stories and sharing their imagination",
    Storytelling: "telling wonderful stories and sharing their imagination",
    Creative: "using their creativity to make amazing things",
    Music: "making beautiful music and sharing their melodies",
    Science: "exploring science and discovering how the world works",
    Leadership: "leading others and making a positive difference",
    Empathy: "caring about others and making the world kinder",
  };

  const activity = talentDescriptions[talentTheme] ?? "showing their amazing talents";

  return `${entryCount} young talent${entryCount > 1 ? "s" : ""} from ${countryList} ${entryCount > 1 ? "are" : "is"} ${activity}!`;
}

/**
 * Get a mock clustering response based on the provided gallery entries.
 *
 * Implements deterministic clustering:
 * 1. Groups entries by talent category
 * 2. Sub-groups by geographic region
 * 3. Generates friendly labels and descriptions
 *
 * Adds artificial delay to simulate real API latency.
 */
export async function getMockClustering(
  entries: ClusterEntry[],
): Promise<ClusteringOutput> {
  // Simulate API latency (800-1500ms)
  const delay = 800 + Math.random() * 700;
  await new Promise((resolve) => setTimeout(resolve, delay));

  // Group by talent category
  const talentGroups = new Map<string, ClusterEntry[]>();
  for (const entry of entries) {
    const existing = talentGroups.get(entry.talentCategory) ?? [];
    existing.push(entry);
    talentGroups.set(entry.talentCategory, existing);
  }

  const clusters: Cluster[] = [];
  let clusterIndex = 0;

  for (const [talentCategory, groupEntries] of talentGroups) {
    // Sub-group by region
    const regionGroups = new Map<string, ClusterEntry[]>();
    for (const entry of groupEntries) {
      const region = getRegion(entry.country);
      const existing = regionGroups.get(region) ?? [];
      existing.push(entry);
      regionGroups.set(region, existing);
    }

    for (const [region, regionEntries] of regionGroups) {
      clusterIndex++;
      const countries = [
        ...new Set(
          regionEntries
            .map((e) => e.country)
            .filter((c): c is string => c !== null),
        ),
      ];

      clusters.push({
        id: `cluster-${clusterIndex}`,
        label: generateClusterLabel(talentCategory, countries, region),
        description: generateClusterDescription(
          talentCategory,
          countries,
          regionEntries.length,
        ),
        talentTheme: talentCategory,
        countries,
        entryIds: regionEntries.map((e) => e.id),
      });
    }
  }

  return { clusters };
}
