/**
 * Gallery entry types for map and detail pages.
 */

export interface GalleryEntryGeoJSON {
  type: "Feature";
  geometry: {
    type: "Point";
    coordinates: [number, number]; // [lng, lat]
  };
  properties: {
    id: string;
    imageUrl: string;
    talentCategory: string;
    country: string;
    questContext: {
      questTitle?: string;
      dream?: string;
      missionSummaries?: string[];
    } | null;
    createdAt: string;
  };
}

export interface GalleryEntryFeatureCollection {
  type: "FeatureCollection";
  features: GalleryEntryGeoJSON[];
}

export interface GalleryEntryDetail {
  id: string;
  questId: string;
  imageUrl: string;
  talentCategory: string;
  country: string | null;
  coordinates: { lat: number; lng: number } | null;
  questContext: {
    questTitle?: string;
    dream?: string;
    missionSummaries?: string[];
  } | null;
  clusterGroup: string | null;
  createdAt: string;
}

/**
 * Talent category color mapping for map pins.
 */
export const TALENT_CATEGORY_COLORS: Record<string, string> = {
  "Engineering": "#3B82F6",      // blue
  "Engineering/Mekanika": "#3B82F6",
  "Art": "#10B981",              // green
  "Art/Seni Visual": "#10B981",
  "Narrative": "#8B5CF6",        // purple
  "Narrative/Storytelling": "#8B5CF6",
  "Storytelling": "#8B5CF6",
  "Creative": "#F59E0B",         // amber
  "Music": "#EC4899",            // pink
  "Science": "#06B6D4",          // cyan
  "Leadership": "#EF4444",       // red
  "Empathy": "#14B8A6",          // teal
};

export const DEFAULT_PIN_COLOR = "#6B7280"; // gray

export function getTalentCategoryColor(category: string): string {
  // Check exact match first
  if (TALENT_CATEGORY_COLORS[category]) {
    return TALENT_CATEGORY_COLORS[category];
  }
  // Check partial match
  const lowerCategory = category.toLowerCase();
  for (const [key, color] of Object.entries(TALENT_CATEGORY_COLORS)) {
    if (lowerCategory.includes(key.toLowerCase())) {
      return color;
    }
  }
  return DEFAULT_PIN_COLOR;
}
