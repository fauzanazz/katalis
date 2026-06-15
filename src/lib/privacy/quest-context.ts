/**
 * Helpers for sanitizing quest context metadata before returning it from
 * public endpoints.
 *
 * `localContext` is free-text user input and may contain PII; never expose it
 * publicly (COPPA/child-safety).
 */

export function stripLocalContext(
  value: unknown,
): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;

  const record = value as Record<string, unknown>;
  if (!("localContext" in record)) return value;

  const { localContext: _localContext, ...rest } = record;
  return rest;
}
