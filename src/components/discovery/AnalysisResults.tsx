"use client";

import { useTranslations } from "next-intl";
import type { AnalysisOutput } from "@/lib/ai/schemas";

interface AnalysisResultsProps {
  results: AnalysisOutput;
}

/**
 * Displays the talent analysis results with confidence bars and reasoning.
 * Uses child-friendly, encouraging language.
 */
export function AnalysisResults({ results }: AnalysisResultsProps) {
  const t = useTranslations("discover.analysis");

  if (!results.talents || results.talents.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-ink">
          {t("resultsTitle")}
        </h2>
        <p className="mt-1 text-muted-foreground">
          {t("resultsSubtitle")}
        </p>
      </div>

      <div className="flex flex-col gap-4">
        {results.talents.map((talent, index) => (
          <div
            key={`${talent.name}-${index}`}
            className="rounded-xl border border-border bg-card p-5 shadow-sm transition-shadow hover:shadow-md"
            role="article"
            aria-label={t("talentCardLabel", { name: talent.name })}
          >
            {/* Talent name and confidence */}
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-ink">
                {talent.name}
              </h3>
              <span className="text-sm font-medium text-muted-foreground">
                {Math.round(talent.confidence * 100)}%
              </span>
            </div>

            {/* Confidence bar */}
            <div
              className="mb-3 h-2 w-full overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-valuenow={Math.round(talent.confidence * 100)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={t("confidenceLabel", {
                name: talent.name,
                percent: Math.round(talent.confidence * 100),
              })}
            >
              <div
                className="h-full rounded-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-500"
                style={{ width: `${talent.confidence * 100}%` }}
              />
            </div>

            {/* Reasoning */}
            <p className="text-sm leading-relaxed text-muted-foreground">
              {talent.reasoning}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
