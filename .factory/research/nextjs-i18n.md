# Next.js App Router i18n — Research Summary

> Researched: 2026-03-31 | Context: Bilingual app (Indonesian `id` + English `en`)

---

## 1. Recommended Approach: `next-intl`

**`next-intl` is the clear community consensus for Next.js App Router i18n in 2025-2026.**

| Metric | Value |
|---|---|
| NPM weekly downloads | ~2.3 million |
| Current version | v4.8.x |
| GitHub | [amannn/next-intl](https://github.com/amannn/next-intl) |
| Maintainer | Jan Amann |
| License | MIT |

### Why `next-intl` over alternatives?

- **`next-i18next`**: Was the standard for Pages Router but **does NOT support App Router**. It wraps `i18next`/`react-i18next` which are client-side only. Effectively deprecated for modern Next.js.
- **Next.js built-in `i18n` config**: Only existed for Pages Router (`next.config.js > i18n`). **Removed / not available in App Router**.
- **`react-intl` (FormatJS)**: Works but requires significant manual wiring for App Router server components. Not Next.js-specific.
- **`intlayer`**: Newer alternative; smaller community, less battle-tested.
- **`next-intl`**: Purpose-built for App Router, native Server Component support, built-in routing/middleware, ICU message format, TypeScript-first, actively maintained.

---

## 2. Project File Structure

```
src/
├── i18n/
│   ├── routing.ts          # defineRouting() — shared locale config
│   ├── request.ts          # getRequestConfig() — loads messages per request
│   └── navigation.ts       # createNavigation() — locale-aware Link, redirect, etc.
├── messages/
│   ├── en.json             # English translations
│   └── id.json             # Indonesian translations
├── middleware.ts            # next-intl middleware for locale routing
└── app/
    └── [locale]/           # Dynamic route segment for locale
        ├── layout.tsx      # Root layout with NextIntlClientProvider
        ├── page.tsx        # Home page
        └── dashboard/
            └── page.tsx
```

### Translation files (`messages/en.json`)

Use **namespaced flat JSON** — one file per locale, keys grouped by page/component:

```json
{
  "Common": {
    "appName": "Katalis",
    "loading": "Loading...",
    "save": "Save",
    "cancel": "Cancel"
  },
  "Navigation": {
    "home": "Home",
    "dashboard": "Dashboard",
    "settings": "Settings"
  },
  "HomePage": {
    "title": "Welcome to Katalis",
    "description": "Your business management platform"
  },
  "Auth": {
    "login": "Log In",
    "logout": "Log Out",
    "email": "Email",
    "password": "Password"
  }
}
```

```json
// messages/id.json
{
  "Common": {
    "appName": "Katalis",
    "loading": "Memuat...",
    "save": "Simpan",
    "cancel": "Batal"
  },
  "Navigation": {
    "home": "Beranda",
    "dashboard": "Dasbor",
    "settings": "Pengaturan"
  },
  "HomePage": {
    "title": "Selamat Datang di Katalis",
    "description": "Platform manajemen bisnis Anda"
  },
  "Auth": {
    "login": "Masuk",
    "logout": "Keluar",
    "email": "Email",
    "password": "Kata Sandi"
  }
}
```

> **Tip**: For large apps, `next-intl` also supports splitting messages by namespace and loading them per-page (see "message splitting" in docs). But for a bilingual app, single file per locale is fine to start.

---

## 3. Setup Code Patterns

### Install

```bash
npm install next-intl
```

### `src/i18n/routing.ts` — Define locales

```ts
import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['en', 'id'],
  defaultLocale: 'id', // Indonesian as default
});
```

### `src/i18n/navigation.ts` — Locale-aware navigation

```ts
import { createNavigation } from 'next-intl/navigation';
import { routing } from './routing';

export const { Link, redirect, usePathname, useRouter } =
  createNavigation(routing);
```

### `src/i18n/request.ts` — Load messages per request

```ts
import { getRequestConfig } from 'next-intl/server';
import { routing } from './routing';

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;

  // Validate that the incoming locale is supported
  if (!locale || !routing.locales.includes(locale as any)) {
    locale = routing.defaultLocale;
  }

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
```

### `src/middleware.ts` — Locale routing middleware

```ts
import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

export default createMiddleware(routing);

export const config = {
  // Match all pathnames except for API routes, static files, etc.
  matcher: ['/', '/(id|en)/:path*'],
};
```

### `next.config.ts` — Plugin setup

```ts
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig = {
  // your other config
};

export default withNextIntl(nextConfig);
```

### `src/app/[locale]/layout.tsx` — Root layout

```tsx
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  // Validate locale
  if (!routing.locales.includes(locale as any)) {
    notFound();
  }

  // Load all messages for client components
  const messages = await getMessages();

  return (
    <html lang={locale}>
      <body>
        <NextIntlClientProvider messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
```

---

## 4. Server Components vs Client Components

### Server Components (default in App Router)

Use `getTranslations()` from `next-intl/server`:

```tsx
// app/[locale]/page.tsx — Server Component (default)
import { getTranslations } from 'next-intl/server';

export default async function HomePage() {
  const t = await getTranslations('HomePage');

  return (
    <div>
      <h1>{t('title')}</h1>
      <p>{t('description')}</p>
    </div>
  );
}
```

### Client Components

Use `useTranslations()` hook (requires `NextIntlClientProvider` in parent layout):

```tsx
'use client';

import { useTranslations } from 'next-intl';

export default function LoginForm() {
  const t = useTranslations('Auth');

  return (
    <form>
      <label>{t('email')}</label>
      <input type="email" />
      <label>{t('password')}</label>
      <input type="password" />
      <button type="submit">{t('login')}</button>
    </form>
  );
}
```

### Key rules:

| Aspect | Server Component | Client Component |
|---|---|---|
| Import | `getTranslations` from `next-intl/server` | `useTranslations` from `next-intl` |
| Async | Yes (`await`) | No (hook) |
| Provider needed | No | Yes (`NextIntlClientProvider`) |
| Bundle impact | Zero (server only) | Translations included in client bundle |
| Best for | Pages, layouts, static content | Interactive UI, forms, dynamic content |

**Best practice**: Keep translations in Server Components when possible. Only use client components for interactive parts. Pass translated strings as props to client components when feasible to minimize client bundle.

---

## 5. URL-Based Locale Routing (Recommended)

### Approach: `/en/page` vs `/id/page` ✅ (Recommended)

`next-intl` uses **URL-prefix-based routing** via the `[locale]` dynamic segment:

```
/id          → Indonesian (default)
/id/dashboard → Indonesian dashboard
/en          → English
/en/dashboard → English dashboard
```

### Why URL-based over cookie-based?

| Factor | URL-based (`/en/...`) | Cookie-based |
|---|---|---|
| SEO | ✅ Excellent — each locale has unique URL, crawlable | ❌ Poor — same URL for all locales |
| Shareable links | ✅ Links preserve language | ❌ Language depends on user cookie |
| SSR/SSG compatible | ✅ Full support | ⚠️ Requires dynamic rendering |
| Caching | ✅ Each locale cached separately | ❌ Can't cache by locale |
| `next-intl` support | ✅ First-class | ⚠️ Possible but not recommended |

### Optional: Hide default locale prefix

If you want `/dashboard` (no prefix) for Indonesian and `/en/dashboard` for English:

```ts
// i18n/routing.ts
export const routing = defineRouting({
  locales: ['en', 'id'],
  defaultLocale: 'id',
  localePrefix: 'as-needed', // hides prefix for default locale
});
```

This makes:
- `/dashboard` → Indonesian (default, no prefix)
- `/en/dashboard` → English

---

## 6. Language Switcher Component

```tsx
'use client';

import { useLocale } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/navigation';

const localeLabels: Record<string, string> = {
  en: 'English',
  id: 'Bahasa Indonesia',
};

export default function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  function switchLocale(newLocale: string) {
    router.replace(pathname, { locale: newLocale });
  }

  return (
    <select
      value={locale}
      onChange={(e) => switchLocale(e.target.value)}
      aria-label="Select language"
    >
      {Object.entries(localeLabels).map(([code, label]) => (
        <option key={code} value={code}>
          {label}
        </option>
      ))}
    </select>
  );
}
```

Or using `Link` for better accessibility / SSR:

```tsx
'use client';

import { useLocale } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';

export default function LanguageSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();

  const otherLocale = locale === 'en' ? 'id' : 'en';
  const label = locale === 'en' ? 'Bahasa Indonesia' : 'English';

  return (
    <Link href={pathname} locale={otherLocale}>
      {label}
    </Link>
  );
}
```

---

## 7. Quick Reference: Full Setup Checklist

1. `npm install next-intl`
2. Create `messages/en.json` and `messages/id.json`
3. Create `src/i18n/routing.ts` with `defineRouting()`
4. Create `src/i18n/request.ts` with `getRequestConfig()`
5. Create `src/i18n/navigation.ts` with `createNavigation()`
6. Create `src/middleware.ts` with `createMiddleware()`
7. Update `next.config.ts` with `createNextIntlPlugin`
8. Move app content under `src/app/[locale]/`
9. Wrap layout with `NextIntlClientProvider`
10. Use `getTranslations()` in server components, `useTranslations()` in client components

---

## 8. Sources

- [next-intl Official Docs — App Router](https://next-intl.dev/docs/getting-started/app-router)
- [next-intl Server & Client Components](https://next-intl.dev/docs/environments/server-client-components)
- [next-intl Routing Configuration](https://next-intl.dev/docs/routing/configuration)
- [next-intl NPM](https://www.npmjs.com/package/next-intl) — ~2.3M weekly downloads
- [next-intl GitHub](https://github.com/amannn/next-intl) — actively maintained, v4.8.x
- [Reddit: Full i18n comparison](https://www.reddit.com/r/nextjs/comments/1nuxkrk/) — community consensus on next-intl
- [Next.js Launchpad: App Router i18n Guide (2026)](https://nextjslaunchpad.com/article/nextjs-internationalization-next-intl-app)
- [IntlPull: next-intl Complete Guide 2026](https://intlpull.com/blog/next-intl-complete-guide-2026)
