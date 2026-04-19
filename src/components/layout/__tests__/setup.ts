import { vi } from "vitest";

const mockNavigationState = vi.hoisted(() => ({
  locale: "en",
  pathname: "/",
  push: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
}));

export function setMockLocale(locale: string) {
  mockNavigationState.locale = locale;
}

export function setMockPathname(pathname: string) {
  mockNavigationState.pathname = pathname;
}

export function resetNavigationMocks() {
  mockNavigationState.locale = "en";
  mockNavigationState.pathname = "/";
  mockNavigationState.push.mockReset();
  mockNavigationState.replace.mockReset();
  mockNavigationState.refresh.mockReset();
}

export const mockRouterReplace = mockNavigationState.replace;

// Mock next-intl
vi.mock("next-intl", () => {
  const translations: Record<string, string> = {
    "common.appName": "Katalis",
    "common.skipToContent": "Skip to content",
    "common.close": "Close",
    "nav.home": "Home",
    "nav.discover": "Discover",
    "nav.quest": "Quest",
    "nav.gallery": "Gallery",
    "nav.login": "Login",
    "nav.logout": "Logout",
    "landing.hero.title": "Discover – Act – Connect",
    "landing.hero.subtitle":
      "A talent discovery and development platform for children",
    "landing.hero.cta": "Get Started",
    "landing.pillars.discover.title": "Discover",
    "landing.pillars.discover.description":
      "Upload drawings, photos, or record stories.",
    "landing.pillars.act.title": "Act",
    "landing.pillars.act.description":
      "Get a personalized 7-day quest plan based on your talents.",
    "landing.pillars.connect.title": "Connect",
    "landing.pillars.connect.description":
      "Showcase your completed works on a global map.",
    "footer.tagline":
      "Empowering children to discover, act, and connect.",
    "footer.copyright": "© 2026 Katalis. All rights reserved.",
    "language.en": "English",
    "language.id": "Bahasa Indonesia",
    "language.zh": "Chinese",
    "language.switch": "Switch Language",
    "notFound.title": "Page Not Found",
    "notFound.description":
      "Oops! The page you are looking for doesn't exist.",
    "notFound.backHome": "Go Back Home",
  };

  return {
    useTranslations: (namespace?: string) => {
      return (key: string, params?: Record<string, unknown>) => {
        const fullKey = namespace ? `${namespace}.${key}` : key;
        let value = translations[fullKey] || fullKey;
        if (params) {
          Object.entries(params).forEach(([k, v]) => {
            value = value.replace(`{${k}}`, String(v));
          });
        }
        return value;
      };
    },
    useLocale: () => mockNavigationState.locale,
  };
});

// Mock @/i18n/navigation
vi.mock("@/i18n/navigation", async () => {
  const React = await import("react");
  return {
    Link: ({ href, children, ...props }: Record<string, unknown>) => {
      return React.createElement(
        "a",
        { href: typeof href === "string" ? href : "/", ...props },
        children as React.ReactNode,
      );
    },
    usePathname: () => mockNavigationState.pathname,
    useRouter: () => ({
      push: mockNavigationState.push,
      replace: mockNavigationState.replace,
      refresh: mockNavigationState.refresh,
    }),
  };
});
