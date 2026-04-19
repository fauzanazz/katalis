"use client";

import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { Check, ChevronDown, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function LanguageSwitcher() {
  const locale = useLocale();
  const t = useTranslations("language");
  const pathname = usePathname();
  const router = useRouter();

  const currentLocale = routing.locales.includes(locale as (typeof routing.locales)[number])
    ? (locale as (typeof routing.locales)[number])
    : routing.defaultLocale;
  function handleSwitch(nextLocale: (typeof routing.locales)[number]) {
    router.replace(
      { pathname },
      { locale: nextLocale },
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          aria-label={t("switch")}
          className="min-h-[44px] min-w-[44px] gap-1.5"
        >
          <Globe className="size-4" />
          <span className="text-sm font-medium">{t(currentLocale)}</span>
          <ChevronDown className="size-4 opacity-70" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="min-w-[12rem]">
        {routing.locales.map((availableLocale) => {
          const isActive = availableLocale === currentLocale;

          return (
            <DropdownMenuItem
              key={availableLocale}
              disabled={isActive}
              onSelect={() => handleSwitch(availableLocale)}
              className="justify-between gap-3"
            >
              <span>{t(availableLocale)}</span>
              {isActive ? <Check className="size-4 text-primary" /> : null}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
