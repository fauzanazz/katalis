"use client";

import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { Globe } from "lucide-react";
import { Button } from "@/components/ui/button";

export function LanguageSwitcher() {
  const locale = useLocale();
  const t = useTranslations("language");
  const pathname = usePathname();
  const router = useRouter();

  const targetLocale = locale === "en" ? "id" : "en";

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
