import {
  overwriteGetLocale,
  localStorageKey,
  baseLocale,
  locales,
  type Locale,
} from "@/paraglide/runtime";

/**
 * Offline locale handling.
 *
 * The shared Paraglide runtime resolves locale via [url, cookie, baseLocale],
 * but the offline SPA has no meaningful URL/cookie. We pin the locale from
 * localStorage (defaulting to the base locale) via `overwriteGetLocale`, so
 * every `m.*()` call renders the chosen language without a page reload.
 */
export function getStoredLocale(): Locale {
  if (typeof localStorage === "undefined") return baseLocale;
  const stored = localStorage.getItem(localStorageKey);
  return (locales as readonly string[]).includes(stored ?? "")
    ? (stored as Locale)
    : baseLocale;
}

export function setStoredLocale(locale: Locale): void {
  localStorage.setItem(localStorageKey, locale);
  overwriteGetLocale(() => locale);
}

/** Call once on app boot, before rendering. */
export function initLocale(): void {
  overwriteGetLocale(() => getStoredLocale());
}
