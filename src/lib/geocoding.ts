/**
 * Simple country-level geocoding utility.
 *
 * Parses location text from local context to approximate coordinates
 * using a country-level lookup table. Not full address resolution —
 * intentionally coarse for privacy (no child location data beyond country level).
 */

export interface GeoCoordinates {
  lat: number;
  lng: number;
}

/**
 * Country-level geocoding table with approximate center coordinates.
 * Covers major countries, with emphasis on regions where Katalis users are expected.
 */
const COUNTRY_COORDINATES: Record<string, GeoCoordinates> = {
  // Southeast Asia (primary target)
  indonesia: { lat: -2.5, lng: 118.0 },
  malaysia: { lat: 4.2, lng: 101.9 },
  singapore: { lat: 1.35, lng: 103.8 },
  philippines: { lat: 12.9, lng: 121.8 },
  thailand: { lat: 15.9, lng: 100.9 },
  vietnam: { lat: 14.1, lng: 108.3 },
  myanmar: { lat: 21.9, lng: 96.0 },
  cambodia: { lat: 12.6, lng: 104.9 },
  laos: { lat: 19.9, lng: 102.5 },
  brunei: { lat: 4.5, lng: 114.7 },
  "timor-leste": { lat: -8.9, lng: 125.7 },

  // East Asia
  japan: { lat: 36.2, lng: 138.3 },
  china: { lat: 35.9, lng: 104.2 },
  "south korea": { lat: 35.9, lng: 127.8 },
  korea: { lat: 35.9, lng: 127.8 },
  taiwan: { lat: 23.7, lng: 121.0 },
  mongolia: { lat: 46.9, lng: 103.8 },

  // South Asia
  india: { lat: 20.6, lng: 79.0 },
  bangladesh: { lat: 23.7, lng: 90.4 },
  pakistan: { lat: 30.4, lng: 69.3 },
  "sri lanka": { lat: 7.9, lng: 80.8 },
  nepal: { lat: 28.4, lng: 84.1 },

  // Middle East
  "saudi arabia": { lat: 23.9, lng: 45.1 },
  "united arab emirates": { lat: 23.4, lng: 53.8 },
  uae: { lat: 23.4, lng: 53.8 },
  turkey: { lat: 39.0, lng: 35.2 },

  // Africa
  nigeria: { lat: 9.1, lng: 8.7 },
  "south africa": { lat: -30.6, lng: 22.9 },
  kenya: { lat: -0.02, lng: 37.9 },
  egypt: { lat: 26.8, lng: 30.8 },
  ethiopia: { lat: 9.1, lng: 40.5 },
  ghana: { lat: 7.9, lng: -1.0 },
  tanzania: { lat: -6.4, lng: 34.9 },

  // Americas
  "united states": { lat: 37.1, lng: -95.7 },
  usa: { lat: 37.1, lng: -95.7 },
  canada: { lat: 56.1, lng: -106.3 },
  brazil: { lat: -14.2, lng: -51.9 },
  mexico: { lat: 23.6, lng: -102.6 },
  argentina: { lat: -38.4, lng: -63.6 },
  colombia: { lat: 4.6, lng: -74.3 },
  peru: { lat: -9.2, lng: -75.0 },
  chile: { lat: -35.7, lng: -71.5 },

  // Europe
  "united kingdom": { lat: 55.4, lng: -3.4 },
  uk: { lat: 55.4, lng: -3.4 },
  germany: { lat: 51.2, lng: 10.5 },
  france: { lat: 46.2, lng: 2.2 },
  italy: { lat: 41.9, lng: 12.6 },
  spain: { lat: 40.5, lng: -3.7 },
  netherlands: { lat: 52.1, lng: 5.3 },
  russia: { lat: 61.5, lng: 105.3 },
  portugal: { lat: 39.4, lng: -8.2 },
  sweden: { lat: 60.1, lng: 18.6 },

  // Oceania
  australia: { lat: -25.3, lng: 133.8 },
  "new zealand": { lat: -40.9, lng: 174.9 },
  "papua new guinea": { lat: -6.3, lng: 147.2 },

  // Indonesian provinces/regions (common local context references)
  jawa: { lat: -7.15, lng: 110.14 },
  java: { lat: -7.15, lng: 110.14 },
  sumatra: { lat: -0.59, lng: 101.5 },
  sumatera: { lat: -0.59, lng: 101.5 },
  kalimantan: { lat: 0.96, lng: 114.55 },
  borneo: { lat: 0.96, lng: 114.55 },
  sulawesi: { lat: -1.43, lng: 121.45 },
  celebes: { lat: -1.43, lng: 121.45 },
  bali: { lat: -8.34, lng: 115.09 },
  papua: { lat: -4.27, lng: 138.08 },
  lombok: { lat: -8.65, lng: 116.32 },
  flores: { lat: -8.66, lng: 121.07 },
  jakarta: { lat: -6.21, lng: 106.85 },
  bandung: { lat: -6.91, lng: 107.61 },
  surabaya: { lat: -7.25, lng: 112.75 },
  yogyakarta: { lat: -7.80, lng: 110.36 },
  medan: { lat: 3.60, lng: 98.67 },
  makassar: { lat: -5.14, lng: 119.42 },
  semarang: { lat: -6.97, lng: 110.42 },
  malang: { lat: -7.98, lng: 112.63 },
};

/**
 * Indonesian keywords that indicate Indonesia when no country is explicitly mentioned.
 * Common terms used in local context descriptions by Indonesian children.
 */
const INDONESIAN_KEYWORDS = [
  "desa",      // village
  "kampung",   // hamlet/village
  "sawah",     // rice field
  "sungai",    // river
  "gunung",    // mountain
  "pantai",    // beach
  "laut",      // sea
  "hutan",     // forest
  "kota",      // city
  "kabupaten", // regency
  "kecamatan", // district
  "kelurahan", // sub-district
  "rt",        // neighborhood unit
  "rw",        // community unit
  "pesantren", // islamic boarding school
  "sekolah",   // school (Indonesian)
  "rumah",     // house (Indonesian)
  "pasar",     // market
  "masjid",    // mosque
  "warung",    // small shop/eatery
];

/**
 * Parse location text from local context to approximate coordinates.
 *
 * Attempts to identify a country or major region from the text and returns
 * approximate center coordinates. Uses simple keyword matching — not full
 * address resolution — intentionally coarse for privacy.
 *
 * @param locationText - Free-form text describing the child's local context
 * @returns GeoCoordinates if a location can be identified, null otherwise
 */
export function geocodeLocationText(
  locationText: string | null | undefined,
): { country: string; coordinates: GeoCoordinates } | null {
  if (!locationText || typeof locationText !== "string") {
    return null;
  }

  const normalizedText = locationText.toLowerCase().trim();

  if (!normalizedText) {
    return null;
  }

  // Try to match country/region names in the text (longest match first)
  const sortedKeys = Object.keys(COUNTRY_COORDINATES).sort(
    (a, b) => b.length - a.length,
  );

  for (const key of sortedKeys) {
    // Use word boundary matching for short keys, substring for longer ones
    const pattern =
      key.length <= 3
        ? new RegExp(`\\b${escapeRegExp(key)}\\b`, "i")
        : new RegExp(escapeRegExp(key), "i");

    if (pattern.test(normalizedText)) {
      const coords = COUNTRY_COORDINATES[key];
      // Determine the display country name
      const countryName = getCountryDisplayName(key);
      return { country: countryName, coordinates: coords };
    }
  }

  // Check for Indonesian keywords as fallback (default to Indonesia)
  const hasIndonesianKeyword = INDONESIAN_KEYWORDS.some((keyword) =>
    normalizedText.includes(keyword),
  );

  if (hasIndonesianKeyword) {
    return {
      country: "Indonesia",
      coordinates: COUNTRY_COORDINATES.indonesia,
    };
  }

  // If text contains "village", "river", "farm", etc. but no country,
  // return null — we can't determine the location
  return null;
}

/**
 * Get a display-friendly country name from the lookup key.
 */
function getCountryDisplayName(key: string): string {
  const displayNames: Record<string, string> = {
    usa: "United States",
    uk: "United Kingdom",
    uae: "United Arab Emirates",
    korea: "South Korea",
    jawa: "Indonesia",
    java: "Indonesia",
    sumatra: "Indonesia",
    sumatera: "Indonesia",
    kalimantan: "Indonesia",
    borneo: "Indonesia",
    sulawesi: "Indonesia",
    celebes: "Indonesia",
    bali: "Indonesia",
    papua: "Indonesia",
    lombok: "Indonesia",
    flores: "Indonesia",
    jakarta: "Indonesia",
    bandung: "Indonesia",
    surabaya: "Indonesia",
    yogyakarta: "Indonesia",
    medan: "Indonesia",
    makassar: "Indonesia",
    semarang: "Indonesia",
    malang: "Indonesia",
  };

  if (displayNames[key]) return displayNames[key];

  // Capitalize each word
  return key
    .split(/[\s-]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Escape special regex characters in a string.
 */
function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
