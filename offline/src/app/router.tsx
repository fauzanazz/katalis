import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import { useEffect, type FC } from "react";
import { Award, Compass, House, Image, Settings as SettingsIcon } from "lucide-react";
import type { Locale } from "@/paraglide/runtime";
import { m } from "@/paraglide/messages";
import { useApp } from "./context";
import { t } from "../data/types";
import { STR } from "../strings";
import { Home } from "../screens/Home";
import { Profiles } from "../screens/Profiles";
import { Discover } from "../screens/Discover";
import { Quest } from "../screens/Quest";
import { Badges } from "../screens/Badges";
import { Gallery } from "../screens/Gallery";
import { Settings } from "../screens/Settings";

type NavPath = "/" | "/discover" | "/badges" | "/gallery" | "/settings";

const NAV: ReadonlyArray<{
  to: NavPath;
  icon: typeof House;
  label: (locale: Locale) => string;
}> = [
  { to: "/", icon: House, label: () => m.nav_home() },
  { to: "/discover", icon: Compass, label: () => m.nav_discover() },
  { to: "/badges", icon: Award, label: () => m.badges_title() },
  { to: "/gallery", icon: Image, label: () => m.nav_gallery() },
  { to: "/settings", icon: SettingsIcon, label: (locale) => t(STR.settingsTitle, locale) },
];

function AppShell() {
  const { profile, loading, locale } = useApp();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  // Gate behind an active profile: send to the profile picker until one exists.
  useEffect(() => {
    if (!loading && !profile && pathname !== "/profiles") {
      navigate({ to: "/profiles" });
    }
  }, [loading, profile, pathname, navigate]);

  const showNav = profile && pathname !== "/profiles";

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col bg-general-surface">
      <main className="flex-1 pb-20">
        <Outlet />
      </main>
      {showNav ? (
        <nav className="fixed inset-x-0 bottom-0 z-20 mx-auto flex max-w-md items-stretch justify-around border-t border-border bg-plain-surface/95 backdrop-blur">
          {NAV.map(({ to, icon: Icon, label }) => {
            const active = to === "/" ? pathname === "/" : pathname.startsWith(to);
            return (
              <button
                key={to}
                type="button"
                onClick={() => navigate({ to })}
                className={`flex flex-1 flex-col items-center gap-1 py-2 text-xs font-medium transition-colors ${
                  active ? "text-primary" : "text-muted-foreground"
                }`}
                aria-current={active ? "page" : undefined}
              >
                <Icon className="size-6" aria-hidden />
                {label(locale)}
              </button>
            );
          })}
        </nav>
      ) : null}
    </div>
  );
}

const rootRoute = createRootRoute({ component: AppShell });

const makeRoute = (path: string, component: FC) =>
  createRoute({ getParentRoute: () => rootRoute, path, component });

const routeTree = rootRoute.addChildren([
  makeRoute("/", Home),
  makeRoute("/profiles", Profiles),
  makeRoute("/discover", Discover),
  createRoute({ getParentRoute: () => rootRoute, path: "/quest/$questId", component: Quest }),
  makeRoute("/badges", Badges),
  makeRoute("/gallery", Gallery),
  makeRoute("/settings", Settings),
]);

export const router = createRouter({
  routeTree,
  history: createMemoryHistory({ initialEntries: ["/"] }),
  defaultPreload: false,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
