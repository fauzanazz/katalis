"use client";

import type { ReactNode } from "react";
import { usePathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { SkipToContent } from "@/components/layout/SkipToContent";

type LocaleShellProps = {
  children: ReactNode;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isParent: boolean;
};

const AUTH_PATHS = ["/login", "/register"];

export function LocaleShell({ children, isAuthenticated, isAdmin, isParent }: LocaleShellProps) {
  const pathname = usePathname();
  const isLanding =
    pathname === "/" ||
    pathname === "" ||
    routing.locales.some((locale) => pathname === `/${locale}`);
  const isAuth = AUTH_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));

  return (
    <>
      <SkipToContent />
      {!isLanding ? (
        <Header isAuthenticated={isAuthenticated} isAdmin={isAdmin} isParent={isParent} />
      ) : null}
      <main id="main-content" role="main" className="flex flex-1 flex-col">
        {children}
      </main>
      {!isLanding && !isAuth ? <Footer /> : null}
    </>
  );
}
