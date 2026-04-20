"use client";

import { useTranslations } from "next-intl";

interface ReportData {
  id: string;
  childId: string;
  type: string;
  period: { start: string; end: string };
  strengths: string[];
  growthAreas: string[];
  tips: Array<{
    title: string;
    description: string;
    materials: string[];
    category: string;
  }>;
  summary: string;
  badgeHighlights: string[];
  createdAt: string;
}

interface ReportViewProps {
  report: ReportData;
}

export function ReportView({ report }: ReportViewProps) {
  const t = useTranslations("parent.report");

  const periodLabel = report.type === "weekly"
    ? t("weeklyReport")
    : t("biweeklyReport");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">{periodLabel}</h2>
        <p className="text-sm text-muted-foreground">
          {t("period", {
            start: new Date(report.period.start).toLocaleDateString(),
            end: new Date(report.period.end).toLocaleDateString(),
          })}
        </p>
      </div>

      <div className="rounded-lg border bg-primary/5 p-4">
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-primary">
          {t("summaryLabel")}
        </h3>
        <p className="text-sm leading-relaxed">{report.summary}</p>
      </div>

      {report.strengths.length > 0 && (
        <div>
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-green-700">
            <span aria-hidden="true">💪</span>
            {t("strengthsLabel")}
          </h3>
          <ul className="space-y-2">
            {report.strengths.map((strength, i) => (
              <li key={i} className="flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 p-3">
                <span className="mt-0.5 text-green-600" aria-hidden="true">✓</span>
                <span className="text-sm">{strength}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {report.growthAreas.length > 0 && (
        <div>
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-amber-700">
            <span aria-hidden="true">🌱</span>
            {t("growthLabel")}
          </h3>
          <ul className="space-y-2">
            {report.growthAreas.map((area, i) => (
              <li key={i} className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
                <span className="mt-0.5 text-amber-600" aria-hidden="true">→</span>
                <span className="text-sm">{area}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {report.tips.length > 0 && (
        <div>
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-blue-700">
            <span aria-hidden="true">🏠</span>
            {t("tipsLabel")}
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {report.tips.map((tip) => (
              <div key={tip.title} className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                <h4 className="text-sm font-semibold text-blue-900">{tip.title}</h4>
                <p className="mt-1 text-xs text-blue-800">{tip.description}</p>
                {tip.materials.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {tip.materials.map((mat) => (
                      <span key={mat} className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] text-blue-700">
                        {mat}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {report.badgeHighlights.length > 0 && (
        <div>
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-purple-700">
            <span aria-hidden="true">🏆</span>
            {t("badgesLabel")}
          </h3>
          <div className="flex flex-wrap gap-2">
            {report.badgeHighlights.map((badge) => (
              <span key={badge} className="inline-flex items-center rounded-full bg-purple-100 px-3 py-1 text-xs font-medium text-purple-700">
                {badge.replace(/_/g, " ")}
              </span>
            ))}
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        {t("generatedAt", { date: new Date(report.createdAt).toLocaleDateString() })}
      </p>
    </div>
  );
}
