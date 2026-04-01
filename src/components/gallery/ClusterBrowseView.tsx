"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { getTalentCategoryColor } from "@/types/gallery";

interface ClusterEntry {
  id: string;
  imageUrl: string;
  talentCategory: string;
  country: string | null;
  questContext: {
    questTitle?: string;
    dream?: string;
    missionSummaries?: string[];
  } | null;
  createdAt: string;
}

interface ClusterData {
  id: string;
  label: string;
  description: string;
  talentTheme: string;
  countries: string[];
  entryIds: string[];
  entries: ClusterEntry[];
}

interface ClusterBrowseViewProps {
  selectedClusterId: string | null;
  onClusterSelect: (clusterId: string | null) => void;
}

/**
 * Cluster browse view showing AI-generated clusters of gallery works.
 * Lists clusters with member works, countries represented, and shared talent theme.
 * Click cluster to see all works in it.
 */
export function ClusterBrowseView({
  selectedClusterId,
  onClusterSelect,
}: ClusterBrowseViewProps) {
  const t = useTranslations("gallery.clusters");
  const [clusters, setClusters] = useState<ClusterData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchClusters = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/gallery/cluster", { method: "POST" });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = await response.json();
      setClusters(data.clusters ?? []);
    } catch (err) {
      console.error("Failed to fetch clusters:", err);
      setError(err instanceof Error ? err.message : "Failed to load clusters");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchClusters();
  }, [fetchClusters]);

  // Loading state
  if (isLoading) {
    return (
      <div
        className="flex min-h-[300px] items-center justify-center rounded-lg bg-muted/50"
        role="status"
        aria-label={t("loading")}
      >
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">{t("loading")}</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
        <p className="text-sm text-red-800 dark:text-red-200">{t("error")}</p>
        <button
          onClick={fetchClusters}
          className="mt-2 text-sm font-medium text-red-700 underline hover:text-red-900 dark:text-red-300"
        >
          {t("viewAll")}
        </button>
      </div>
    );
  }

  // Empty state
  if (clusters.length === 0) {
    return (
      <div className="rounded-lg border bg-muted/30 p-6 text-center">
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      </div>
    );
  }

  // Show specific cluster detail
  const selectedCluster = selectedClusterId
    ? clusters.find((c) => c.id === selectedClusterId)
    : null;

  if (selectedCluster) {
    return (
      <div role="region" aria-label={t("clusterDetail", { label: selectedCluster.label })}>
        <button
          onClick={() => onClusterSelect(null)}
          className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15.75 19.5 8.25 12l7.5-7.5"
            />
          </svg>
          {t("backToClusters")}
        </button>

        <div className="mb-4">
          <div className="flex items-center gap-2">
            <span
              className="inline-block h-4 w-4 rounded-full"
              style={{ backgroundColor: getTalentCategoryColor(selectedCluster.talentTheme) }}
              aria-hidden="true"
            />
            <h2 className="text-lg font-semibold">{selectedCluster.label}</h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {selectedCluster.description}
          </p>
          <div className="mt-2 flex flex-wrap gap-1">
            {selectedCluster.countries.map((country) => (
              <span
                key={country}
                className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
              >
                {country}
              </span>
            ))}
          </div>
        </div>

        {/* Cluster entries grid */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {selectedCluster.entries.map((entry) => (
            <Link
              key={entry.id}
              href={`/gallery/${entry.id}`}
              className="group overflow-hidden rounded-lg border bg-card transition-shadow hover:shadow-md"
            >
              <div className="relative aspect-video overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={entry.imageUrl}
                  alt={`${entry.talentCategory} work from ${entry.country ?? "unknown"}`}
                  className="h-full w-full object-cover transition-transform group-hover:scale-105"
                  loading="lazy"
                />
              </div>
              <div className="p-3">
                <div className="flex items-center gap-2">
                  <span
                    className="inline-block h-3 w-3 rounded-full"
                    style={{ backgroundColor: getTalentCategoryColor(entry.talentCategory) }}
                    aria-hidden="true"
                  />
                  <span className="text-sm font-medium">{entry.talentCategory}</span>
                </div>
                {entry.country && (
                  <p className="mt-1 text-xs text-muted-foreground">{entry.country}</p>
                )}
              </div>
            </Link>
          ))}
        </div>
      </div>
    );
  }

  // Cluster list view
  return (
    <div role="region" aria-label={t("ariaLabel")}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {clusters.map((cluster) => (
          <button
            key={cluster.id}
            onClick={() => onClusterSelect(cluster.id)}
            className="group rounded-lg border bg-card p-4 text-left transition-shadow hover:shadow-md"
            aria-label={`${cluster.label} - ${t("worksCount", { count: cluster.entries.length })}`}
          >
            {/* Cluster header */}
            <div className="mb-2 flex items-center gap-2">
              <span
                className="inline-block h-4 w-4 rounded-full"
                style={{ backgroundColor: getTalentCategoryColor(cluster.talentTheme) }}
                aria-hidden="true"
              />
              <h3 className="font-semibold group-hover:text-primary">
                {cluster.label}
              </h3>
            </div>

            {/* Description */}
            <p className="mb-3 text-sm text-muted-foreground">
              {cluster.description}
            </p>

            {/* Thumbnail preview (first 3 entries) */}
            <div className="mb-3 flex -space-x-2">
              {cluster.entries.slice(0, 3).map((entry) => (
                <div
                  key={entry.id}
                  className="relative h-10 w-10 overflow-hidden rounded-full border-2 border-background"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={entry.imageUrl}
                    alt=""
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                </div>
              ))}
              {cluster.entries.length > 3 && (
                <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-background bg-muted text-xs font-medium text-muted-foreground">
                  +{cluster.entries.length - 3}
                </div>
              )}
            </div>

            {/* Footer stats */}
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{t("worksCount", { count: cluster.entries.length })}</span>
              <div className="flex gap-1">
                {cluster.countries.slice(0, 3).map((country) => (
                  <span key={country} className="rounded bg-muted px-1.5 py-0.5">
                    {country}
                  </span>
                ))}
                {cluster.countries.length > 3 && (
                  <span className="rounded bg-muted px-1.5 py-0.5">
                    +{cluster.countries.length - 3}
                  </span>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
