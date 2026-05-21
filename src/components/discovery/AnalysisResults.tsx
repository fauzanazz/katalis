"use client";

import { useTranslations } from "next-intl";
import type { AnalysisOutput } from "@/lib/ai/schemas";

const TALENT_PALETTE = [
  { bg: "#fff9e6", accent: "#f6a926" }, // warm amber
  { bg: "#eef4ff", accent: "#5794f6" }, // ocean blue
  { bg: "#f0f9f7", accent: "#5fa899" }, // sage teal
  { bg: "#fdf1f8", accent: "#c070a0" }, // soft rose
  { bg: "#f3f2fa", accent: "#7a75b8" }, // lavender
] as const;

interface AnalysisResultsProps {
  results: AnalysisOutput;
}

export function AnalysisResults({ results }: AnalysisResultsProps) {
  const t = useTranslations("discover.analysis");

  if (!results.talents || results.talents.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="text-center">
        <h2 className="type-h2">{t("resultsTitle")}</h2>
        <p className="mt-2 text-muted-foreground">{t("resultsSubtitle")}</p>
      </div>

      <div className="flex flex-col gap-3">
        {results.talents.map((talent, index) => {
          const palette = TALENT_PALETTE[index % TALENT_PALETTE.length];
          const pct = Math.round(talent.confidence * 100);

          return (
            <div
              key={`${talent.name}-${index}`}
              className="rounded-2xl p-5"
              style={{ backgroundColor: palette.bg }}
              role="article"
              aria-label={t("talentCardLabel", { name: talent.name })}
            >
              {/* Name + percentage badge */}
              <div className="mb-3 flex items-start justify-between gap-3">
                <h3 className="text-lg font-bold text-ink">{talent.name}</h3>
                <span
                  className="shrink-0 rounded-full px-2.5 py-0.5 text-sm font-bold text-white"
                  style={{ backgroundColor: palette.accent }}
                >
                  {pct}%
                </span>
              </div>

              {/* Confidence bar */}
              <div
                className="mb-3 h-1.5 w-full overflow-hidden rounded-full"
                style={{ backgroundColor: `${palette.accent}22` }}
                role="progressbar"
                aria-valuenow={pct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={t("confidenceLabel", {
                  name: talent.name,
                  percent: pct,
                })}
              >
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${pct}%`,
                    backgroundColor: palette.accent,
                  }}
                />
              </div>

              {/* Reasoning */}
              <p className="text-sm leading-relaxed text-ink/70">
                {talent.reasoning}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
