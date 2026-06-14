import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";
import { decrypt, SESSION_COOKIE_NAME } from "@/lib/auth";

const intlMiddleware = createMiddleware(routing);

function countryToLocale(country: string | undefined): string | null {
  if (!country) return null;
  if (country === "ID") return "id";
  if (["CN", "TW", "HK", "MO"].includes(country)) return "zh";
  return "en";
}

const publicPagePaths = ["/register", "", "/gallery", "/privacy", "/terms", "/contact", "/discover", "/quest/new", "/quest/preview"];
const publicPathPrefixes = ["/gallery", "/login", "/discover"];

function isPublicPage(pathnameWithoutLocale: string): boolean {
  const exactMatch = publicPagePaths.some(
    (path) =>
      pathnameWithoutLocale === path ||
      pathnameWithoutLocale === path + "/",
  );
  if (exactMatch) return true;
  return publicPathPrefixes.some((prefix) =>
    pathnameWithoutLocale.startsWith(prefix),
  );
}

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/api/auth")) return NextResponse.next();
  if (pathname.startsWith("/api/")) return NextResponse.next();
  if (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/favicon.ico") ||
    pathname.match(/\.(svg|png|jpg|jpeg|gif|ico|webp)$/)
  ) {
    return NextResponse.next();
  }

  const intlResponse = intlMiddleware(request);

  const localePattern = new RegExp(`^/(${routing.locales.join("|")})(/|$)`);
  const localeMatch = pathname.match(localePattern);
  const locale = localeMatch ? localeMatch[1] : null;

  if (!locale) {
    const cookieLocale = request.cookies.get("NEXT_LOCALE")?.value;
    if (cookieLocale && (routing.locales as readonly string[]).includes(cookieLocale)) {
      return intlResponse;
    }
    const country = request.headers.get("x-vercel-ip-country") ?? undefined;
    const geoLocale = countryToLocale(country);
    if (geoLocale) {
      const url = request.nextUrl.clone();
      url.pathname = `/${geoLocale}${pathname === "/" ? "" : pathname}`;
      return NextResponse.redirect(url);
    }
    return intlResponse;
  }

  const pathnameWithoutLocale =
    pathname.replace(new RegExp(`^/(${routing.locales.join("|")})`), "") || "/";

  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = await decrypt(sessionCookie);

  const isPublic = isPublicPage(pathnameWithoutLocale);
  const isAuthenticated = !!(session?.childId || session?.userId);
  const isUser = session?.type === "user";
  const isAdmin = isUser && session?.role === "admin";

  // Authenticated landing target by role: admin → /admin, parent → /parent,
  // child → /discover (matches child login default in login/child/page.tsx).
  const homeFor = (l: string) =>
    isAdmin ? `/${l}/admin` : isUser ? `/${l}/parent` : `/${l}/discover`;

  if (isAuthenticated && (pathnameWithoutLocale === "/login" || pathnameWithoutLocale === "/register")) {
    return NextResponse.redirect(new URL(homeFor(locale), request.url));
  }

  if (!isAuthenticated && !isPublic) {
    return NextResponse.redirect(new URL(`/${locale}/login`, request.url));
  }

  // Parent area requires a parent (user-type) session. A child session is
  // "authenticated" but the parent APIs reject it (401) — without this guard
  // the page bounces /parent → /login → /parent forever.
  if (pathnameWithoutLocale.startsWith("/parent")) {
    if (!isAuthenticated) {
      return NextResponse.redirect(new URL(`/${locale}/login`, request.url));
    }
    if (!isUser) {
      return NextResponse.redirect(new URL(`/${locale}/discover`, request.url));
    }
  }

  if (pathnameWithoutLocale.startsWith("/admin")) {
    if (!isAuthenticated) {
      return NextResponse.redirect(new URL(`/${locale}/login`, request.url));
    }
    if (!isAdmin) {
      return NextResponse.redirect(new URL(`/${locale}/parent`, request.url));
    }
  }

  return intlResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
