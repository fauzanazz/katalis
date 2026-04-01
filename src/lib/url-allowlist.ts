/**
 * URL origin allowlist for storage URLs.
 *
 * Validates that submitted URLs come from trusted storage origins
 * (defense-in-depth measure to prevent SSRF and data exfiltration).
 */

/**
 * Allowed URL origins for storage-related inputs.
 * Includes the app's own URL, the R2 public URL, and common local storage patterns.
 */
function getAllowedOrigins(): string[] {
  const origins: string[] = [];

  // App URL (e.g., http://localhost:3100)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (appUrl) {
    try {
      origins.push(new URL(appUrl).origin);
    } catch {
      // Invalid URL, skip
    }
  }

  // R2 public URL (e.g., http://localhost:3100/api/storage)
  const r2Url = process.env.R2_PUBLIC_URL;
  if (r2Url) {
    try {
      origins.push(new URL(r2Url).origin);
    } catch {
      // Invalid URL, skip
    }
  }

  // Always allow localhost variations for development
  origins.push("http://localhost:3100");

  // Deduplicate
  return [...new Set(origins)];
}

/**
 * Check if a URL string comes from an allowed storage origin.
 *
 * Returns true if the URL's origin matches one of the allowed origins,
 * or if the URL is a relative path (starts with /).
 * Returns false for URLs from untrusted origins.
 */
export function isAllowedStorageUrl(url: string): boolean {
  if (typeof url !== "string" || url.trim() === "") {
    return false;
  }

  // Allow relative paths (e.g., /api/storage/images/file.jpg)
  if (url.startsWith("/")) {
    return true;
  }

  try {
    const parsed = new URL(url);
    const allowedOrigins = getAllowedOrigins();

    return allowedOrigins.some(
      (origin) => parsed.origin === origin,
    );
  } catch {
    // Not a valid URL
    return false;
  }
}
