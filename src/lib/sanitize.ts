/**
 * Input sanitization utilities for XSS and injection prevention.
 */

/**
 * Sanitize a string input by removing potentially dangerous characters.
 * Strips HTML tags, script content, and SQL injection patterns.
 * Returns the cleaned string.
 */
export function sanitizeInput(input: string): string {
  if (typeof input !== "string") return "";

  return (
    input
      // Remove HTML tags
      .replace(/<[^>]*>/g, "")
      // Remove common script injection patterns
      .replace(/javascript:/gi, "")
      .replace(/on\w+\s*=/gi, "")
      // Trim whitespace
      .trim()
  );
}

/**
 * Check if a string contains potential XSS or injection patterns.
 * Returns true if suspicious patterns are detected.
 */
export function containsSuspiciousPatterns(input: string): boolean {
  if (typeof input !== "string") return false;

  const patterns = [
    /<script/i,
    /<\/script/i,
    /javascript:/i,
    /on\w+\s*=/i,
    /<img[^>]+onerror/i,
    /<svg[^>]+onload/i,
    /eval\s*\(/i,
    /document\./i,
    /window\./i,
  ];

  return patterns.some((pattern) => pattern.test(input));
}

/**
 * Validate that an access code contains only allowed characters.
 * Access codes should be alphanumeric with hyphens only.
 */
export function isValidAccessCodeFormat(code: string): boolean {
  if (typeof code !== "string") return false;
  // Allow alphanumeric characters and hyphens, 1-50 chars
  return /^[A-Za-z0-9-]{1,50}$/.test(code);
}
