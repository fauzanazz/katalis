"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { LanguageSwitcher } from "./LanguageSwitcher";

interface HeaderProps {
  isAuthenticated: boolean;
}

const NAV_LINKS = [
  { href: "/discover", labelKey: "discover" },
  { href: "/quest", labelKey: "quest" },
  { href: "/gallery", labelKey: "gallery" },
] as const;

export function Header({ isAuthenticated }: HeaderProps) {
  const t = useTranslations("nav");
  const tCommon = useTranslations("common");
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  async function handleLogout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      window.location.href = "/";
    } catch {
      // Fallback: redirect anyway
      window.location.href = "/";
    }
  }

  return (
    <header
      role="banner"
      className="sticky top-0 z-40 border-b border-border bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80"
    >
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link
          href="/"
          className="flex items-center gap-2 text-lg font-bold text-ink"
        >
          {tCommon("appName")}
        </Link>

        {/* Desktop nav */}
        <nav role="navigation" aria-label="Main navigation" className="hidden md:flex md:items-center md:gap-1">
          {NAV_LINKS.map((link) => {
            const isActive = pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`inline-flex min-h-[44px] items-center rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-muted text-ink"
                    : "text-muted-foreground hover:bg-muted hover:text-ink"
                }`}
              >
                {t(link.labelKey)}
              </Link>
            );
          })}
        </nav>

        {/* Desktop actions */}
        <div className="hidden items-center gap-1 md:flex">
          <LanguageSwitcher />
          {isAuthenticated ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="min-h-[44px]"
            >
              {t("logout")}
            </Button>
          ) : (
            <Button asChild variant="default" size="sm" className="min-h-[44px]">
              <Link href="/login">{t("login")}</Link>
            </Button>
          )}
        </div>

        {/* Mobile hamburger */}
        <div className="flex items-center gap-1 md:hidden">
          <LanguageSwitcher />
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Open menu"
                className="min-h-[44px] min-w-[44px]"
              >
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[280px] p-0">
              <SheetHeader className="border-b border-border">
                <SheetTitle className="text-left text-lg font-bold">
                  {tCommon("appName")}
                </SheetTitle>
              </SheetHeader>
              <nav
                role="navigation"
                aria-label="Mobile navigation"
                className="flex flex-col px-2 py-4"
              >
                {NAV_LINKS.map((link) => {
                  const isActive = pathname.startsWith(link.href);
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setMobileOpen(false)}
                      className={`flex min-h-[44px] items-center rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                        isActive
                          ? "bg-muted text-ink"
                          : "text-muted-foreground hover:bg-muted hover:text-ink"
                      }`}
                    >
                      {t(link.labelKey)}
                    </Link>
                  );
                })}
                <div className="my-2 border-t border-border" />
                {isAuthenticated ? (
                  <button
                    onClick={() => {
                      setMobileOpen(false);
                      handleLogout();
                    }}
                    className="flex min-h-[44px] items-center rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-ink"
                  >
                    {t("logout")}
                  </button>
                ) : (
                  <Link
                    href="/login"
                    onClick={() => setMobileOpen(false)}
                    className="flex min-h-[44px] items-center rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-ink"
                  >
                    {t("login")}
                  </Link>
                )}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
