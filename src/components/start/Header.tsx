import { useState, useMemo } from "react";
import { Menu } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { exitChildFn, logoutFn } from "@/lib/server/auth";
import { m } from "@/paraglide/messages";
import { LocaleLink, useLocalePathname, useLocaleRouter } from "@/i18n/start-navigation";
import { GooeyNav } from "./GooeyNav";
import { LanguageSwitcher } from "./LanguageSwitcher";

interface HeaderProps {
  isAuthenticated: boolean;
  isAdmin: boolean;
  isParent: boolean;
}

const CHILD_NAV_LINKS = [
  { href: "/discover", labelKey: "discover" },
  { href: "/quest", labelKey: "quest" },
  { href: "/gallery", labelKey: "gallery" },
] as const;

const PARENT_NAV_LINKS = [
  { href: "/parent", labelKey: "dashboard" },
  { href: "/gallery", labelKey: "gallery" },
] as const;

// Paraglide message fns are individual exports — static map for dynamic dispatch.
const NAV_LABEL: Record<string, () => string> = {
  discover: m.nav_discover,
  quest: m.nav_quest,
  gallery: m.nav_gallery,
  dashboard: m.nav_dashboard,
};

export function Header({ isAuthenticated, isAdmin, isParent }: HeaderProps) {
  const pathname = useLocalePathname();
  const router = useLocaleRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const navLinkClass =
    "inline-flex min-h-[44px] min-w-[44px] max-w-full items-center justify-center rounded-lg px-3 text-xs font-medium text-foreground transition-colors hover:bg-zinc-100 md:px-3 md:text-sm";

  const NAV_LINKS = isParent ? PARENT_NAV_LINKS : CHILD_NAV_LINKS;
  const isChild = isAuthenticated && !isParent && !isAdmin;
  const logoHref = isParent ? "/parent" : isChild ? "/home" : "/";

  const gooeyItems = useMemo(
    () => NAV_LINKS.map((link) => ({ label: NAV_LABEL[link.labelKey](), href: link.href })),
    // NAV_LINKS is a module-level constant; locale changes trigger a full re-render anyway
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // Child "logout" exits to the parent dashboard (no password); parent logout
  // tears down the whole session.
  async function handleLogout() {
    try {
      await (isChild ? exitChildFn() : logoutFn());
    } catch {
      // Fall through to redirect regardless
    }
    if (isChild) {
      router.push("/parent");
      router.refresh();
    } else {
      window.location.href = "/";
    }
  }

  const logoutLabel = isChild ? m.nav_exitChild() : m.nav_logout();

  return (
    <header
      role="banner"
      className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/95 py-3 backdrop-blur-sm"
    >
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 md:px-8 lg:px-10 xl:max-w-6xl">
        <LocaleLink href={logoHref} className="flex min-w-0 items-center gap-2.5">
          <img
            src="/images/katalis-logo.webp"
            alt=""
            width={44}
            height={44}
            className="size-10 shrink-0 object-contain sm:size-11"
            aria-hidden
          />
          <span className="font-rubik truncate text-base font-medium text-foreground sm:text-lg">
            {m.landing_brandName()}
          </span>
        </LocaleLink>

        <nav
          role="navigation"
          aria-label="Main navigation"
          className="hidden min-w-0 flex-1 items-center justify-end gap-1 md:flex lg:gap-2"
        >
          <GooeyNav items={gooeyItems} particleCount={12} />
          {isAdmin && (
            <LocaleLink
              href="/admin"
              className={cn(navLinkClass, pathname.startsWith("/admin") && "bg-zinc-100")}
            >
              {m.nav_admin()}
            </LocaleLink>
          )}
          {isAuthenticated ? (
            <button onClick={handleLogout} className={navLinkClass}>
              {logoutLabel}
            </button>
          ) : (
            <LocaleLink
              href="/login"
              className={cn(navLinkClass, pathname === "/login" && "bg-zinc-100")}
            >
              {m.nav_login()}
            </LocaleLink>
          )}
          <div className="ml-2 pl-2 lg:ml-4 lg:border-l lg:border-border lg:pl-4">
            <LanguageSwitcher />
          </div>
        </nav>

        <div className="shrink-0 md:hidden">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-foreground"
                aria-label={m.landing_openMenu()}
              >
                <Menu className="size-6" strokeWidth={1.5} />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[min(100%,320px)]">
              <SheetHeader>
                <SheetTitle>{m.landing_navSheetTitle()}</SheetTitle>
              </SheetHeader>
              <nav className="mt-6 flex flex-col gap-1 px-1" aria-label="Mobile navigation">
                {NAV_LINKS.map((link) => (
                  <LocaleLink
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileOpen(false)}
                    className={cn(navLinkClass, "justify-start", pathname.startsWith(link.href) && "bg-zinc-100")}
                  >
                    {NAV_LABEL[link.labelKey]()}
                  </LocaleLink>
                ))}
                {isAuthenticated ? (
                  <button
                    onClick={() => {
                      setMobileOpen(false);
                      handleLogout();
                    }}
                    className={cn(navLinkClass, "justify-start")}
                  >
                    {logoutLabel}
                  </button>
                ) : (
                  <LocaleLink
                    href="/login"
                    onClick={() => setMobileOpen(false)}
                    className={cn(navLinkClass, "justify-start", pathname === "/login" && "bg-zinc-100")}
                  >
                    {m.nav_login()}
                  </LocaleLink>
                )}
                <div className="mt-4 border-t border-zinc-200 pt-4">
                  <LanguageSwitcher />
                </div>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
