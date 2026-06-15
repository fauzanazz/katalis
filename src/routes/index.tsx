import { createFileRoute, redirect } from "@tanstack/react-router";

import { baseLocale } from "@/paraglide/runtime";

// Root entry redirects to the base-locale home, matching the Next app where every
// route is locale-prefixed.
export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({ to: "/$locale", params: { locale: baseLocale } });
  },
});
