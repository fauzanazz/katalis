"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { ReportView } from "@/components/parent/ReportView";

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

export default function ParentReportsPage() {
  const t = useTranslations("parent.reports");
  const searchParams = useSearchParams();
  const childId = searchParams.get("childId");

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
      const response = await fetch(`/api/parent/reports?childId=${childId}`);
      if (!response.ok) throw new Error("Failed to fetch");
      const data = await response.json();
      setReports(data.reports ?? []);
    } catch (err) {
      console.error("Failed to fetch reports:", err);
    } finally {
      setIsLoading(false);
    }
  }, [childId]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const handleGenerate = async () => {
    if (!childId) return;
    setGenerating(true);
    try {
      const response = await fetch("/api/parent/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ childId, type: "weekly" }),
      });
      if (!response.ok) {
        const data = await response.json();
        alert(data.message || t("generateError"));
        return;
      }
      const data = await response.json();
      setReports((prev) => [data.report, ...prev]);
    } catch {
      alert(t("generateError"));
    } finally {
      setGenerating(false);
    }
  };

  if (!childId) {
    return (
      <div className="container mx-auto px-4 py-6">
        <p className="text-muted-foreground">{t("noChildSelected")}</p>
        <Link href="/parent" className="mt-2 inline-flex items-center gap-1 text-sm text-primary hover:underline">
          {t("backToDashboard")}
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-3xl px-4 py-6">
      <Link
        href="/parent"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
        </svg>
        {t("backToDashboard")}
      </Link>

      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {generating ? t("generating") : t("generateNew")}
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
            {t("backToList")}
          </button>
          <ReportView report={selectedReport} />
        </div>
      ) : reports.length === 0 ? (
        <div className="rounded-lg border bg-muted/30 p-6 text-center">
          <p className="text-muted-foreground">{t("noReports")}</p>
          <button
            onClick={handleGenerate}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            {t("generateFirst")}
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
                    {report.type === "weekly" ? t("weekly") : t("biweekly")}
                  </span>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t("period", {
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
    </div>
  );
}
