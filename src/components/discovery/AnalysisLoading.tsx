"use client";

import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";

/**
 * Loading state shown during AI analysis.
 * Displays a spinner with encouraging text.
 */
export function AnalysisLoading() {
  const t = useTranslations("discover.analysis");

  return (
    <div
      className="flex flex-col items-center gap-4 py-12"
      role="status"
      aria-live="polite"
    >
      <Loader2 className="size-12 animate-spin text-blue-500" />
      <div className="text-center">
        <p className="text-lg font-medium text-zinc-900 dark:text-zinc-50">
          {t("loading")}
        </p>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          {t("loadingSubtext")}
        </p>
      </div>
    </div>
  );
}
