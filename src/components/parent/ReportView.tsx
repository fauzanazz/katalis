"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { InterestRadarChart, type InterestDimension } from "./report/InterestRadarChart";
import { GrowthTimeline, type GrowthSnapshot } from "./report/GrowthTimeline";
import { MissionEngagement, type EngagementData } from "./report/MissionEngagement";
import { ActionableSuggestions, type Suggestion } from "./report/ActionableSuggestions";

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
  // Visual report data (optional — render sections only when provided)
  interests?: InterestDimension[];
  growthSnapshots?: GrowthSnapshot[];
  engagement?: EngagementData;
  suggestions?: Suggestion[];
}

interface ReportViewProps {
  report: ReportData;
}

export function ReportView({ report }: ReportViewProps) {
  const t = useTranslations("parent.report");
  const [downloading, setDownloading] = useState(false);

  const periodLabel = report.type === "weekly"
    ? t("weeklyReport")
    : t("biweeklyReport");

  async function handleDownloadPdf() {
    setDownloading(true);
    try {
      window.open(`/api/parent/reports/${report.id}/pdf`, "_blank");
    } finally {
      setTimeout(() => setDownloading(false), 1000);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">{periodLabel}</h2>
          <p className="text-sm text-muted-foreground">
            {t("period", {
              start: new Date(report.period.start).toLocaleDateString(),
              end: new Date(report.period.end).toLocaleDateString(),
            })}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleDownloadPdf}
          disabled={downloading}
          className="shrink-0 gap-1.5"
        >
          {downloading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Download className="size-4" />
          )}
          {t("downloadPdf")}
        </Button>
      </div>

      <div className="rounded-xl border border-blue-ocean-light/20 bg-blue-ocean-light/5 p-5">
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-primary">
          {t("summaryLabel")}
        </h3>
        <p className="text-sm leading-relaxed text-foreground">{report.summary}</p>
      </div>

      {report.strengths.length > 0 && (
        <div>
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-green-leaf-deep">
            {t("strengthsLabel")}
          </h3>
          <ul className="space-y-2">
            {report.strengths.map((strength, i) => (
              <li key={i} className="flex items-center gap-3 rounded-xl border border-green-leaf/40 bg-green-leaf-light/20 px-4 py-3">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-green-leaf-deep/20 text-xs text-green-leaf-deep" aria-hidden="true">✓</span>
                <span className="text-sm">{strength}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {report.growthAreas.length > 0 && (
        <div>
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-yellow-sun-deep">
            {t("growthLabel")}
          </h3>
          <ul className="space-y-2">
            {report.growthAreas.map((area, i) => (
              <li key={i} className="flex items-center gap-3 rounded-xl border border-yellow-sun/30 bg-yellow-sun-light/15 px-4 py-3">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-yellow-sun/20 text-xs text-yellow-sun-deep" aria-hidden="true">→</span>
                <span className="text-sm">{area}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {report.tips.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-primary">
            {t("tipsLabel")}
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {report.tips.map((tip) => (
              <div key={tip.title} className="rounded-xl border border-blue-ocean-light/30 bg-blue-ocean-light/8 p-4">
                <h4 className="text-sm font-semibold text-foreground">{tip.title}</h4>
                <p className="mt-1 text-xs text-muted-foreground">{tip.description}</p>
                {tip.materials.length > 0 && (
                  <div className="mt-2.5 flex flex-wrap gap-1">
                    {tip.materials.map((mat) => (
                      <span key={mat} className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
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
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-lavender-mist">
            {t("badgesLabel")}
          </h3>
          <div className="flex flex-wrap gap-2">
            {report.badgeHighlights.map((badge) => (
              <span key={badge} className="inline-flex items-center rounded-full bg-lavender-mist/15 px-3 py-1 text-xs font-medium text-lavender-mist">
                {badge.replace(/_/g, " ")}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Visual Report Sections ── */}

      {report.interests && report.interests.length >= 3 && (
        <InterestRadarChart interests={report.interests} />
      )}

      {report.growthSnapshots && report.growthSnapshots.length >= 2 && (
        <GrowthTimeline snapshots={report.growthSnapshots} />
      )}

      {report.engagement && (
        <MissionEngagement engagement={report.engagement} />
      )}

      {report.suggestions && report.suggestions.length > 0 && (
        <ActionableSuggestions suggestions={report.suggestions} />
      )}

      <p className="text-xs text-muted-foreground">
        {t("generatedAt", { date: new Date(report.createdAt).toLocaleDateString() })}
      </p>
    </div>
  );
}
