"use client";

import { useTranslations } from "next-intl";
import { usePathname, Link } from "@/i18n/navigation";
import { ChevronRight, Home } from "lucide-react";

/**
 * Breadcrumbs component that shows the current area context.
 * Extracts path segments from the locale-stripped pathname.
 */

interface BreadcrumbSegment {
  label: string;
  href: string;
}

const AREA_LABELS: Record<string, string> = {
  discover: "discover",
  quest: "quest",
  gallery: "gallery",
  history: "history",
  results: "results",
  new: "new",
  complete: "complete",
  login: "home",
  dashboard: "home",
};

export function Breadcrumbs() {
  const t = useTranslations("breadcrumb");
  const pathname = usePathname();

  // Skip breadcrumbs on root/landing page
  if (pathname === "/" || pathname === "") {
    return null;
  }

  const segments = pathname.split("/").filter(Boolean);
  const breadcrumbs: BreadcrumbSegment[] = [
    { label: t("home"), href: "/" },
  ];

  let currentPath = "";
  for (const segment of segments) {
    currentPath += `/${segment}`;
    const labelKey = AREA_LABELS[segment];
    if (labelKey) {
      breadcrumbs.push({
        label: t(labelKey),
        href: currentPath,
      });
    }
    // Skip UUID/ID segments in breadcrumbs (they're not meaningful labels)
  }

  // Don't render if only home
  if (breadcrumbs.length <= 1) {
    return null;
  }

  return (
    <nav
      aria-label="Breadcrumb"
      className="border-b border-zinc-100 bg-zinc-50/80 dark:border-zinc-800 dark:bg-zinc-900/50"
    >
      <div className="mx-auto max-w-5xl px-4 py-2 sm:px-6 lg:px-8">
        <ol className="flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400">
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
                  <span
                    className="font-medium text-zinc-900 dark:text-zinc-100"
                    aria-current="page"
                  >
                    {crumb.label}
                  </span>
                ) : (
                  <Link
                    href={crumb.href}
                    className="transition-colors hover:text-zinc-900 dark:hover:text-zinc-100"
                  >
                    {crumb.label}
                  </Link>
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </nav>
  );
}
