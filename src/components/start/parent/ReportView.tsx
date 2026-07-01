"use client";

import { useState } from "react";
import { m } from "@/paraglide/messages";
import { getLocale } from "@/paraglide/runtime";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { useStepUp } from "@/components/start/auth/use-step-up";
import { downloadReportPdfFn } from "@/lib/server/parent-reports";
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
function isEngagementData(value: ReportData["engagement"]): value is EngagementData {
  return Boolean(
    value &&
      typeof value.completionRate === "number" &&
      typeof value.totalMissions === "number" &&
      typeof value.completedMissions === "number" &&
      Array.isArray(value.creativityBadges),
  );
}
function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function isReportTip(
  value: unknown,
): value is { title: string; description: string; materials: string[]; category: string } {
  return Boolean(
    value &&
      typeof value === "object" &&
      "title" in value &&
      typeof value.title === "string" &&
      "description" in value &&
      typeof value.description === "string" &&
      "materials" in value &&
      Array.isArray(value.materials) &&
      "category" in value &&
      typeof value.category === "string",
  );
}

function asTips(value: unknown): ReportData["tips"] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(isReportTip)
    .map((tip) => ({ ...tip, materials: asStringArray(tip.materials) }));
}



export function ReportView({ report }: ReportViewProps) {
  const locale = getLocale();
  const [downloading, setDownloading] = useState(false);
  const { withStepUp, stepUpDialog } = useStepUp();
  const strengths = asStringArray(report.strengths);
  const growthAreas = asStringArray(report.growthAreas);
  const tips = asTips(report.tips);
  const badgeHighlights = asStringArray(report.badgeHighlights);
  const engagement = isEngagementData(report.engagement) ? report.engagement : null;

  const periodLabel =
    report.type === "weekly"
      ? m.parent_report_weeklyReport()
      : m.parent_report_biweeklyReport();

  async function handleDownloadPdf() {
    setDownloading(true);
    try {
      const res = await withStepUp(() =>
        downloadReportPdfFn({ data: { reportId: report.id } }),
      );
      if (res.ok) {
        const bytes = Uint8Array.from(atob(res.base64), (c) => c.charCodeAt(0));
        const blob = new Blob([bytes], { type: res.contentType });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = res.filename;
        anchor.click();
        URL.revokeObjectURL(url);
      }
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="space-y-6">
      {stepUpDialog}

      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">{periodLabel}</h2>
          <p className="text-sm text-muted-foreground">
            {m.parent_report_period({
              start: new Date(report.period.start).toLocaleDateString(locale),
              end: new Date(report.period.end).toLocaleDateString(locale),
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
          {m.parent_report_downloadPdf()}
        </Button>
      </div>

      <div className="rounded-xl border border-blue-ocean-light/20 bg-blue-ocean-light/5 p-5">
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-primary">
          {m.parent_report_summaryLabel()}
        </h3>
        <p className="text-sm leading-relaxed text-foreground">{report.summary}</p>
      </div>

      {strengths.length > 0 && (
        <div>
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-green-leaf-deep">
            {m.parent_report_strengthsLabel()}
          </h3>
          <ul className="space-y-2">
            {strengths.map((strength, i) => (
              <li
                key={i}
                className="flex items-center gap-3 rounded-xl border border-green-leaf/40 bg-green-leaf-light/20 px-4 py-3"
              >
                <span
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-green-leaf-deep/20 text-xs text-green-leaf-deep"
                  aria-hidden="true"
                >
                  ✓
                </span>
                <span className="text-sm">{strength}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {growthAreas.length > 0 && (
        <div>
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-yellow-sun-deep">
            {m.parent_report_growthLabel()}
          </h3>
          <ul className="space-y-2">
            {growthAreas.map((area, i) => (
              <li
                key={i}
                className="flex items-center gap-3 rounded-xl border border-yellow-sun/30 bg-yellow-sun-light/15 px-4 py-3"
              >
                <span
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-yellow-sun/20 text-xs text-yellow-sun-deep"
                  aria-hidden="true"
                >
                  →
                </span>
                <span className="text-sm">{area}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {tips.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-primary">
            {m.parent_report_tipsLabel()}
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {tips.map((tip) => (
              <div
                key={tip.title}
                className="rounded-xl border border-blue-ocean-light/30 bg-blue-ocean-light/8 p-4"
              >
                <h4 className="text-sm font-semibold text-foreground">{tip.title}</h4>
                <p className="mt-1 text-xs text-muted-foreground">{tip.description}</p>
                {tip.materials.length > 0 && (
                  <div className="mt-2.5 flex flex-wrap gap-1">
                    {tip.materials.map((mat) => (
                      <span
                        key={mat}
                        className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary"
                      >
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

      {badgeHighlights.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-lavender-mist">
            {m.parent_report_badgesLabel()}
          </h3>
          <div className="flex flex-wrap gap-2">
            {badgeHighlights.map((badge) => (
              <span
                key={badge}
                className="inline-flex items-center rounded-full bg-lavender-mist/15 px-3 py-1 text-xs font-medium text-lavender-mist"
              >
                {badge.replace(/_/g, " ")}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Visual Report Sections */}

      {report.interests && report.interests.length >= 3 && (
        <InterestRadarChart interests={report.interests} />
      )}

      {report.growthSnapshots && report.growthSnapshots.length >= 2 && (
        <GrowthTimeline snapshots={report.growthSnapshots} />
      )}

      {engagement && <MissionEngagement engagement={engagement} />}

      {report.suggestions && report.suggestions.length > 0 && (
        <ActionableSuggestions suggestions={report.suggestions} />
      )}

      <p className="text-xs text-muted-foreground">
        {m.parent_report_generatedAt({
          date: new Date(report.createdAt).toLocaleDateString(locale),
        })}
      </p>
    </div>
  );
}
