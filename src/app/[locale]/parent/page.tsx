"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { ClaimChildDialog } from "@/components/parent/ClaimChildDialog";
import { ChildCard } from "@/components/parent/ChildCard";

interface LinkedChildData {
  id: string;
  locale: string;
  claimedAt: string;
  latestTalents?: string[];
  questCount?: number;
  tips?: Array<{
    title: string;
    description: string;
    materials: string[];
    category: string;
  }>;
}

export default function ParentDashboardPage() {
  const t = useTranslations("parent.dashboard");
  const [children, setChildren] = useState<LinkedChildData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showClaimDialog, setShowClaimDialog] = useState(false);

  const fetchChildren = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/parent/children");
      if (response.status === 401) {
        window.location.href = "/login";
        return;
      }
      if (!response.ok) throw new Error("Failed to fetch");
      const data = await response.json();
      setChildren(data.children ?? []);
    } catch (err) {
      console.error("Failed to fetch children:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchChildren();
  }, [fetchChildren]);

  const handleClaimSuccess = () => {
    fetchChildren();
  };

  if (isLoading) {
    return (
      <div className="container mx-auto flex min-h-[50vh] items-center justify-center px-4">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">{t("loading")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <button
          onClick={() => setShowClaimDialog(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          {t("addChild")}
        </button>
      </div>

      {children.length === 0 ? (
        <div className="rounded-lg border bg-muted/30 p-8 text-center">
          <p className="text-lg font-medium text-muted-foreground">{t("noChildren")}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t("noChildrenHint")}</p>
          <button
            onClick={() => setShowClaimDialog(true)}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            {t("addChild")}
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {children.map((child) => (
            <ChildCard key={child.id} child={child} />
          ))}
        </div>
      )}

      <ClaimChildDialog
        open={showClaimDialog}
        onClose={() => setShowClaimDialog(false)}
        onSuccess={handleClaimSuccess}
      />
    </div>
  );
}
