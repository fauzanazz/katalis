"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function LocaleError({ error, reset }: ErrorPageProps) {
  const t = useTranslations("error");

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-20">
      <p className="text-6xl font-bold text-zinc-300">
        ⚠️
      </p>
      <h1 className="mt-4 text-2xl font-bold text-ink">
        {t("title")}
      </h1>
      <p className="mt-2 max-w-md text-center text-sm text-muted-foreground">
        {t("description")}
      </p>
      <div className="mt-8 flex gap-3">
        <Button onClick={reset} variant="default" className="min-h-[44px]">
          {t("retry")}
        </Button>
        <Button asChild variant="outline" className="min-h-[44px]">
          <Link href="/">{t("backHome")}</Link>
        </Button>
      </div>
    </div>
  );
}
