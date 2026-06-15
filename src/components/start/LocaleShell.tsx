import type { ReactNode } from "react";

import { useLocalePathname } from "@/i18n/start-navigation";
import { Footer } from "./Footer";
import { Header } from "./Header";
import { SkipToContent } from "./SkipToContent";

type LocaleShellProps = {
  children: ReactNode;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isParent: boolean;
};

const AUTH_PATHS = ["/login", "/register"];

export function LocaleShell({ children, isAuthenticated, isAdmin, isParent }: LocaleShellProps) {
  const pathname = useLocalePathname();
  const isLanding = pathname === "/";
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
