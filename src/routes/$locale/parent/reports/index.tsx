"use client";

import { useState, useEffect, useCallback } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { m } from "@/paraglide/messages";
import { LocaleLink } from "@/i18n/start-navigation";
import { ReportView } from "@/components/start/parent/ReportView";
import { useStepUp } from "@/components/start/auth/use-step-up";
import {
  listChildReportsFn,
  generateChildReportFn,
  type ReportData,
} from "@/lib/server/parent-reports";

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------
//
// The reports LIST is step-up gated (listChildReportsFn returns
// err("step_up_required")). A server loader cannot surface the re-auth dialog,
// so — exactly like the Next original — the list is fetched CLIENT-SIDE through
// `withStepUp`, which opens the dialog and retries once verified. No SSR loader.

export const Route = createFileRoute("/$locale/parent/reports/")({
  validateSearch: (s: Record<string, unknown>) => ({
    childId: typeof s.childId === "string" ? s.childId : undefined,
  }),
  component: ParentReportsPage,
});

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

function ParentReportsPage() {
  const { childId } = Route.useSearch();
  const { withStepUp, stepUpDialog } = useStepUp();

  const [reports, setReports] = useState<ReportData[]>([]);
  const [selectedReport, setSelectedReport] = useState<ReportData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const fetchReports = useCallback(async () => {
    if (!childId) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const res = await withStepUp(() => listChildReportsFn({ data: { childId } }));
      if (res.ok) {
        setReports(res.reports);
      } else {
        console.error("Failed to fetch reports:", res.error);
      }
    } catch (err) {
      console.error("Failed to fetch reports:", err);
    } finally {
      setIsLoading(false);
    }
  }, [childId, withStepUp]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  async function handleGenerate() {
    if (!childId) return;
    setGenerating(true);
    try {
      const res = await withStepUp(() =>
        generateChildReportFn({ data: { childId, type: "weekly" } }),
      );
      if (!res.ok) {
        toast.error(res.message ?? m.parent_reports_generateError());
        return;
      }
      setReports((prev) => [res.report, ...prev]);
    } catch {
      toast.error(m.parent_reports_generateError());
    } finally {
      setGenerating(false);
    }
  }

  if (!childId) {
    return (
      <div className="container mx-auto px-4 py-6">
        <p className="text-muted-foreground">{m.parent_reports_noChildSelected()}</p>
        <LocaleLink
          href="/parent"
          className="mt-2 inline-flex items-center gap-1 text-sm text-primary hover:underline"
        >
          {m.parent_reports_backToDashboard()}
        </LocaleLink>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-3xl px-4 py-6">
      <LocaleLink
        href="/parent"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <svg
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
        </svg>
        {m.parent_reports_backToDashboard()}
      </LocaleLink>

      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">{m.parent_reports_title()}</h1>
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {generating ? m.parent_reports_generating() : m.parent_reports_generateNew()}
        </button>
      </div>

      {isLoading ? (
        <div className="flex min-h-[200px] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : selectedReport ? (
        <div>
          <button
            onClick={() => setSelectedReport(null)}
            className="mb-4 text-sm text-muted-foreground hover:text-foreground"
          >
            {m.parent_reports_backToList()}
          </button>
          <ReportView report={selectedReport} />
        </div>
      ) : reports.length === 0 ? (
        <div className="rounded-lg border bg-muted/30 p-6 text-center">
          <p className="text-muted-foreground">{m.parent_reports_noReports()}</p>
          <button
            onClick={handleGenerate}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            {m.parent_reports_generateFirst()}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((report) => (
            <button
              key={report.id}
              onClick={() => setSelectedReport(report)}
              className="w-full rounded-lg border bg-card p-4 text-left transition-shadow hover:shadow-md"
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                    {report.type === "weekly"
                      ? m.parent_reports_weekly()
                      : m.parent_reports_biweekly()}
                  </span>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {m.parent_reports_period({
                      start: new Date(report.period.start).toLocaleDateString(),
                      end: new Date(report.period.end).toLocaleDateString(),
                    })}
                  </p>
                </div>
                <span className="text-xs text-muted-foreground">
                  {new Date(report.createdAt).toLocaleDateString()}
                </span>
              </div>
              <p className="mt-2 text-sm line-clamp-2">{report.summary}</p>
            </button>
          ))}
        </div>
      )}

      {stepUpDialog}
    </div>
  );
}
