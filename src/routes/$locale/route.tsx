import { Outlet, createFileRoute, notFound } from "@tanstack/react-router";

import { LocaleShell } from "@/components/start/LocaleShell";
import { getAuthFlags } from "@/lib/auth-flags";
import { isLocale } from "@/paraglide/runtime";

// Locale-prefixed layout route. The active locale is resolved from the URL by the
// global request middleware (SSR) and the Paraglide URL strategy (client); here we
// validate the segment, load auth role flags, and render the shared app chrome.
export const Route = createFileRoute("/$locale")({
  beforeLoad: ({ params }) => {
    if (!isLocale(params.locale)) throw notFound();
  },
  loader: () => getAuthFlags(),
  component: LocaleLayout,
});

function LocaleLayout() {
  const flags = Route.useLoaderData();
  return (
    <LocaleShell
      isAuthenticated={flags.isAuthenticated}
      isAdmin={flags.isAdmin}
      isParent={flags.isParent}
    >
      <Outlet />
    </LocaleShell>
  );
}
