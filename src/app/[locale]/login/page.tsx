"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export default function LoginPage() {
  const t = useTranslations("auth.choose");

  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-background px-4 py-10 sm:py-14">
      <div className="w-full max-w-sm">
        <h1 className="mb-2 text-center text-2xl font-bold text-ink">{t("title")}</h1>
        <p className="mb-8 text-center text-sm text-zinc-500">{t("subtitle")}</p>

        <div className="flex flex-col gap-4">
          <Link
            href="/login/parent"
            className="flex flex-col items-center gap-1 rounded-xl border border-border bg-white px-6 py-6 text-center shadow-sm transition-shadow hover:shadow-md"
          >
            <span className="text-3xl" aria-hidden="true">👨‍👩‍👧</span>
            <span className="mt-1 text-lg font-semibold text-ink">{t("parentTitle")}</span>
            <span className="text-sm text-zinc-500">{t("parentDesc")}</span>
          </Link>

          <Link
            href="/login/child"
            className="flex flex-col items-center gap-1 rounded-xl border border-border bg-white px-6 py-6 text-center shadow-sm transition-shadow hover:shadow-md"
          >
            <span className="text-3xl" aria-hidden="true">🧒</span>
            <span className="mt-1 text-lg font-semibold text-ink">{t("childTitle")}</span>
            <span className="text-sm text-zinc-500">{t("childDesc")}</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
