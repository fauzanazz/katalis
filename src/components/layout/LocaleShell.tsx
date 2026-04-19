"use client";

import type { ReactNode } from "react";
import { usePathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { SkipToContent } from "@/components/layout/SkipToContent";

type LocaleShellProps = {
  children: ReactNode;
  isAuthenticated: boolean;
};

export function LocaleShell({ children, isAuthenticated }: LocaleShellProps) {
  const pathname = usePathname();
  const isLanding =
    pathname === "/" ||
    pathname === "" ||
    routing.locales.some((locale) => pathname === `/${locale}`);

  return (
    <>
      <SkipToContent />
      {!isLanding ? (
        <Header isAuthenticated={isAuthenticated} />
      ) : null}
      {!isLanding ? <Breadcrumbs /> : null}
      <main id="main-content" role="main" className="flex-1">
        {children}
      </main>
      {!isLanding ? <Footer /> : null}
    </>
  );
}
