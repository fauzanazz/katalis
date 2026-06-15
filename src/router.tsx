import { createRouter } from "@tanstack/react-router";

import { routeTree } from "./routeTree.gen";
import { DefaultCatchBoundary } from "@/components/start/DefaultCatchBoundary";
import { StartNotFound } from "@/components/start/StartNotFound";

export function getRouter() {
  return createRouter({
    routeTree,
    defaultPreload: "intent",
    defaultErrorComponent: DefaultCatchBoundary,
    defaultNotFoundComponent: () => <StartNotFound />,
    scrollRestoration: true,
  });
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
