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
import { Award, Compass, House, Image, MessageCircle } from "lucide-react";
import { m } from "@/paraglide/messages";
import { useApp } from "./context";
import { Home } from "../screens/Home";
import { Profiles } from "../screens/Profiles";
import { Discover } from "../screens/Discover";
import { Quest } from "../screens/Quest";
import { Badges } from "../screens/Badges";
import { Gallery } from "../screens/Gallery";
import { Mentor } from "../screens/Mentor";

const NAV = [
  { to: "/", icon: House, labelKey: "nav_home" },
  { to: "/discover", icon: Compass, labelKey: "nav_discover" },
  { to: "/badges", icon: Award, labelKey: "badges_title" },
  { to: "/gallery", icon: Image, labelKey: "nav_gallery" },
  { to: "/mentor", icon: MessageCircle, labelKey: "mentor_chatTitle" },
] as const;

function navLabel(key: (typeof NAV)[number]["labelKey"]): string {
  switch (key) {
    case "nav_home":
      return m.nav_home();
    case "nav_discover":
      return m.nav_discover();
    case "badges_title":
      return m.badges_title();
    case "nav_gallery":
      return m.nav_gallery();
    case "mentor_chatTitle":
      return m.mentor_chatTitle();
  }
}

function AppShell() {
  const { profile, loading } = useApp();
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
          {NAV.map(({ to, icon: Icon, labelKey }) => {
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
                {navLabel(labelKey)}
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
  makeRoute("/mentor", Mentor),
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
