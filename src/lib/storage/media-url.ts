/**
 * Rewrite a stored media URL to a China-reachable mirror for `zh` users.
 *
 * Uploaded media URLs are baked at upload time pointing at the Cloudflare R2
 * public origin (`R2_PUBLIC_URL`), which the Great Firewall throttles. When a
 * CN mirror (e.g. Aliyun OSS) is configured, swap the origin prefix for Chinese
 * locale users; otherwise return the URL unchanged. No-op until both
 * NEXT_PUBLIC_R2_PUBLIC_URL (origin to match) and NEXT_PUBLIC_CN_MEDIA_URL
 * (mirror origin) are set, so it is safe to ship before the mirror exists.
 *
 * Client-safe: reads only NEXT_PUBLIC_* env vars.
 */

const R2_ORIGIN = stripTrailingSlash(process.env.NEXT_PUBLIC_R2_PUBLIC_URL);
const CN_MEDIA_ORIGIN = stripTrailingSlash(process.env.NEXT_PUBLIC_CN_MEDIA_URL);

function stripTrailingSlash(value: string | undefined): string | undefined {
  return value?.replace(/\/$/, "");
}

export function localizeMediaUrl(url: string, locale: string): string {
  if (locale !== "zh" || !R2_ORIGIN || !CN_MEDIA_ORIGIN) return url;
  if (!url.startsWith(`${R2_ORIGIN}/`)) return url;
  return `${CN_MEDIA_ORIGIN}${url.slice(R2_ORIGIN.length)}`;
}
