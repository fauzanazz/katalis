import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";
import { decrypt, SESSION_COOKIE_NAME } from "@/lib/auth";

const intlMiddleware = createMiddleware(routing);

/** Routes that do NOT require authentication (locale-prefixed paths without the locale) */
const publicPagePaths = ["/login", "", "/gallery"];

/** Path prefixes that are public (matched with startsWith) */
const publicPathPrefixes = ["/gallery"];

/** Check if a locale-stripped path is public */
function isPublicPage(pathnameWithoutLocale: string): boolean {
  // Exact match or trailing slash match
  const exactMatch = publicPagePaths.some(
    (path) =>
      pathnameWithoutLocale === path ||
      pathnameWithoutLocale === path + "/",
  );
  if (exactMatch) return true;

  // Prefix match (e.g., /gallery/[id])
  return publicPathPrefixes.some((prefix) =>
    pathnameWithoutLocale.startsWith(prefix),
  );
}

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  // Let API auth routes through without i18n handling
  if (pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  // Let all other API routes through
  if (pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  // Skip static assets and Next.js internals
  if (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/favicon.ico") ||
    pathname.match(/\.(svg|png|jpg|jpeg|gif|ico|webp)$/)
  ) {
    return NextResponse.next();
  }

  // Run intl middleware first to handle locale routing
  const intlResponse = intlMiddleware(request);

  // Build locale regex dynamically from routing config
  const localePattern = new RegExp(`^/(${routing.locales.join("|")})(/|$)`);
  const localeMatch = pathname.match(localePattern);
  const locale = localeMatch ? localeMatch[1] : null;

  // If no locale in path, the intl middleware will redirect — let it
  if (!locale) {
    return intlResponse;
  }

  // Get the path without the locale prefix
  const pathnameWithoutLocale = pathname.replace(new RegExp(`^/(${routing.locales.join("|")})`), "") || "/";

  // Check session
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = await decrypt(sessionCookie);

  const isPublic = isPublicPage(pathnameWithoutLocale);
  const isAuthenticated = !!session?.childId;

  // Redirect authenticated users away from login page to dashboard
  if (isAuthenticated && pathnameWithoutLocale === "/login") {
    return NextResponse.redirect(
      new URL(`/${locale}/dashboard`, request.url),
    );
  }

  // Redirect unauthenticated users to login for protected routes
  if (!isAuthenticated && !isPublic) {
    return NextResponse.redirect(
      new URL(`/${locale}/login`, request.url),
    );
  }

  return intlResponse;
}

export const config = {
  matcher: [
    // Match all paths except static files, Next.js internals
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
