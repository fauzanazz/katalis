"use client";

import { useState } from "react";
import Image from "next/image";
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
import { cn } from "@/lib/utils";
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
  const tNav = useTranslations("nav");
  const tLanding = useTranslations("landing");
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const navLinkClass =
    "inline-flex min-h-[44px] min-w-[44px] max-w-full items-center justify-center rounded-lg px-3 text-xs font-medium text-foreground transition-colors hover:bg-zinc-100 md:px-3 md:text-sm";

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
      className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/95 pt-4 pb-2 backdrop-blur-sm"
    >
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 md:px-8 lg:px-10 xl:max-w-6xl">
        <Link
          href="/"
          className="flex min-w-0 items-center gap-2.5"
        >
          <Image
            src="/images/katalis-logo.png"
            alt=""
            width={44}
            height={44}
            className="size-10 shrink-0 object-contain sm:size-11"
            priority
            aria-hidden
          />
          <span className="font-rubik truncate text-base font-medium text-foreground sm:text-lg">
            {tLanding("brandName")}
          </span>
        </Link>

        <nav
          role="navigation"
          aria-label="Main navigation"
          className="hidden min-w-0 flex-1 items-center justify-end gap-1 md:flex lg:gap-2"
        >
          {NAV_LINKS.map((link) => {
            const isActive = pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(navLinkClass, isActive && "bg-zinc-100")}
              >
                {tNav(link.labelKey)}
              </Link>
            );
          })}
          {isAuthenticated ? (
            <button
              onClick={handleLogout}
              className={navLinkClass}
            >
              {tNav("logout")}
            </button>
          ) : (
            <Link href="/login" className={cn(navLinkClass, pathname === "/login" && "bg-zinc-100")}>
              {tNav("login")}
            </Link>
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
                aria-label={tLanding("openMenu")}
              >
                <Menu className="size-6" strokeWidth={1.5} />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[min(100%,320px)]">
              <SheetHeader>
                <SheetTitle>{tLanding("navSheetTitle")}</SheetTitle>
              </SheetHeader>
              <nav className="mt-6 flex flex-col gap-1 px-1" aria-label="Mobile navigation">
                {NAV_LINKS.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileOpen(false)}
                    className={cn(navLinkClass, "justify-start", pathname.startsWith(link.href) && "bg-zinc-100")}
                  >
                    {tNav(link.labelKey)}
                  </Link>
                ))}
                {isAuthenticated ? (
                  <button
                    onClick={() => {
                      setMobileOpen(false);
                      handleLogout();
                    }}
                    className={cn(navLinkClass, "justify-start")}
                  >
                    {tNav("logout")}
                  </button>
                ) : (
                  <Link
                    href="/login"
                    onClick={() => setMobileOpen(false)}
                    className={cn(navLinkClass, "justify-start", pathname === "/login" && "bg-zinc-100")}
                  >
                    {tNav("login")}
                  </Link>
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
