/**
 * Resolve a stored-image URL to an inline `data:` URL by fetching bytes
 * server-side. Lets us keep R2 buckets private while still feeding images
 * to AI providers (moderation, analysis) that require an inline payload.
 *
 * If the URL doesn't point at our storage (or resolution fails), the
 * original URL is returned unchanged so the caller can fall back to a
 * direct fetch.
 */

import { getStorageClient } from "./index";

function getStoragePrefixes(): string[] {
  const prefixes: string[] = [];
  if (process.env.R2_PUBLIC_URL) prefixes.push(process.env.R2_PUBLIC_URL);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3100";
  prefixes.push(`${appUrl}/uploads`);
  return prefixes.map((p) => p.replace(/\/$/, ""));
}

export function extractKeyFromUrl(url: string): string | null {
  for (const prefix of getStoragePrefixes()) {
    if (url.startsWith(`${prefix}/`)) {
      return url.slice(prefix.length + 1);
    }
  }
  return null;
}

export async function resolveImageToDataUrl(url: string): Promise<string> {
  const key = extractKeyFromUrl(url);
  if (!key) return url;

  try {
    const storage = getStorageClient();
    const { data, contentType } = await storage.getObjectBytes(key);
    return `data:${contentType};base64,${data.toString("base64")}`;
  } catch (error) {
    console.error("[resolveImageToDataUrl] Failed to fetch object:", error);
    return url;
  }
}
