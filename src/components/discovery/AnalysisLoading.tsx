"use client";

import { useTranslations } from "next-intl";

export function AnalysisLoading() {
  const t = useTranslations("discover.analysis");

  return (
    <div
      className="flex flex-col items-center gap-8 py-16"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-end gap-2.5" aria-hidden="true">
        {(
          [
            { color: "#f6a926", delay: "0ms" },
            { color: "#5794f6", delay: "140ms" },
            { color: "#91c2b3", delay: "280ms" },
          ] as const
        ).map(({ color, delay }, i) => (
          <div
            key={i}
            className="size-3.5 rounded-full animate-bounce"
            style={{
              backgroundColor: color,
              animationDelay: delay,
              animationDuration: "0.9s",
            }}
          />
        ))}
      </div>

      <div className="text-center">
        <p className="text-xl font-bold text-ink">{t("loading")}</p>
        <p className="mt-2 max-w-xs text-sm leading-relaxed text-muted-foreground">
          {t("loadingSubtext")}
        </p>
      </div>
    </div>
  );
}
