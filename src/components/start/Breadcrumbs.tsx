import { ChevronRight, Home } from "lucide-react";

import { m } from "@/paraglide/messages";
import { LocaleLink, useLocalePathname } from "@/i18n/start-navigation";

/**
 * Breadcrumbs showing the current area context, derived from the
 * locale-stripped pathname.
 */

interface BreadcrumbSegment {
  label: string;
  href: string;
}

// Path segment -> breadcrumb label fn. Paraglide message fns are individual
// exports, so a static map is needed for dynamic-by-segment dispatch.
const SEGMENT_LABEL: Record<string, () => string> = {
  discover: m.breadcrumb_discover,
  quest: m.breadcrumb_quest,
  gallery: m.breadcrumb_gallery,
  history: m.breadcrumb_history,
  results: m.breadcrumb_results,
  new: m.breadcrumb_new,
  complete: m.breadcrumb_complete,
  login: m.breadcrumb_login,
  dashboard: m.breadcrumb_home,
};

export function Breadcrumbs() {
  const pathname = useLocalePathname();

  // Skip breadcrumbs on root/landing page
  if (pathname === "/" || pathname === "") {
    return null;
  }

  const segments = pathname.split("/").filter(Boolean);
  const breadcrumbs: BreadcrumbSegment[] = [{ label: m.breadcrumb_home(), href: "/" }];

  let currentPath = "";
  for (const segment of segments) {
    currentPath += `/${segment}`;
    const label = SEGMENT_LABEL[segment];
    if (label) {
      breadcrumbs.push({ label: label(), href: currentPath });
    }
    // Skip UUID/ID segments in breadcrumbs (they're not meaningful labels)
  }

  // Don't render if only home
  if (breadcrumbs.length <= 1) {
    return null;
  }

  return (
    <nav aria-label="Breadcrumb" className="border-b border-border/70 bg-background/80">
      <div className="mx-auto max-w-5xl px-4 py-2 sm:px-6 lg:px-8">
        <ol className="flex items-center gap-1 text-xs text-muted-foreground">
          {breadcrumbs.map((crumb, index) => {
            const isLast = index === breadcrumbs.length - 1;
            return (
              <li key={crumb.href} className="flex items-center gap-1">
                {index > 0 && (
                  <ChevronRight className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
                )}
                {index === 0 && (
                  <Home className="mr-0.5 h-3 w-3 flex-shrink-0" aria-hidden="true" />
                )}
                {isLast ? (
                  <span className="font-medium text-ink" aria-current="page">
                    {crumb.label}
                  </span>
                ) : (
                  <LocaleLink href={crumb.href} className="transition-colors hover:text-ink">
                    {crumb.label}
                  </LocaleLink>
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </nav>
  );
}
