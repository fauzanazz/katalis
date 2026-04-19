"use client";

import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { Globe } from "lucide-react";
import { Button } from "@/components/ui/button";

export function LanguageSwitcher() {
  const locale = useLocale();
  const t = useTranslations("language");
  const pathname = usePathname();
  const router = useRouter();

  const currentLocale = routing.locales.includes(locale as (typeof routing.locales)[number])
    ? (locale as (typeof routing.locales)[number])
    : routing.defaultLocale;
  const localeIndex = routing.locales.indexOf(currentLocale);
  const targetLocale =
    routing.locales[(localeIndex + 1) % routing.locales.length] ??
    routing.defaultLocale;

  function handleSwitch() {
    router.replace(
      { pathname },
      { locale: targetLocale },
    );
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleSwitch}
      aria-label={t("switch")}
      className="min-h-[44px] min-w-[44px] gap-1.5"
    >
      <Globe className="size-4" />
      <span className="text-sm font-medium">{t(targetLocale)}</span>
    </Button>
  );
}
