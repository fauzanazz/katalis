/**
 * Client IP extraction helper for API routes.
 *
 * Note: Header-based IP is inherently spoofable unless a trusted proxy (e.g. Vercel)
 * overwrites these headers. We still validate basic shape to avoid garbage identifiers
 * impacting rate limiting.
 */

function firstForwardedFor(value: string | null): string | null {
  if (!value) return null;
  const first = value.split(",")[0]?.trim();
  if (!first) return null;
  return first;
}

function stripIpv4Port(value: string): string {
  // Common forms: "1.2.3.4:12345" or "1.2.3.4"
  if (value.includes(".") && value.includes(":") && !value.includes("::")) {
    return value.split(":")[0] ?? value;
  }
  return value;
}

function isProbablyIp(value: string): boolean {
  // Lightweight checks only. Avoid heavy/strict parsing here.
  const v = value.trim();
  if (!v) return false;
  const ipv4 = /^(?:\d{1,3}\.){3}\d{1,3}$/.test(v);
  const ipv6 = /^[0-9a-fA-F:]+$/.test(v) && v.includes(":");
  return ipv4 || ipv6;
}

export function getClientIp(headers: Headers): string | null {
  const candidates = [
    // Vercel sets this; prefer if present.
    firstForwardedFor(headers.get("x-vercel-forwarded-for")),
    firstForwardedFor(headers.get("x-forwarded-for")),
    headers.get("x-real-ip")?.trim() ?? null,
  ].filter(Boolean) as string[];

  for (const raw of candidates) {
    const value = stripIpv4Port(raw.trim());
    if (isProbablyIp(value)) return value;
  }
  return null;
}
