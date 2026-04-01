"use client";

import { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import type { GalleryEntryFeatureCollection } from "@/types/gallery";

// Dynamic import with SSR disabled to avoid WebGL hydration mismatch
const GalleryMap = dynamic(
  () => import("@/components/map/GalleryMap").then((mod) => mod.GalleryMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[500px] w-full items-center justify-center rounded-lg bg-muted/50 lg:h-[600px]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </div>
    ),
  },
);

export default function GalleryPage() {
  const t = useTranslations("gallery");
  const [data, setData] = useState<GalleryEntryFeatureCollection | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchGalleryData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/gallery/entries/geojson");
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const geojson = (await response.json()) as GalleryEntryFeatureCollection;
      setData(geojson);
    } catch (err) {
      console.error("Failed to fetch gallery data:", err);
      setError(
        err instanceof Error ? err.message : "Failed to load gallery data",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGalleryData();
  }, [fetchGalleryData]);

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          {t("title")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground sm:text-base">
          {t("subtitle")}
        </p>
      </div>

      {/* Error state */}
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
          <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
          <button
            onClick={fetchGalleryData}
            className="mt-2 text-sm font-medium text-red-700 underline hover:text-red-900 dark:text-red-300"
          >
            {t("retry")}
          </button>
        </div>
      )}

      {/* Map container */}
      <GalleryMap data={data} isLoading={isLoading} />

      {/* Empty state message (shown when loaded but no entries) */}
      {!isLoading && data && data.features.length === 0 && (
        <div className="mt-6 rounded-lg border bg-muted/30 p-6 text-center">
          <p className="text-sm text-muted-foreground">
            {t("map.noEntries")}
          </p>
        </div>
      )}

      {/* Entry count */}
      {!isLoading && data && data.features.length > 0 && (
        <p className="mt-4 text-xs text-muted-foreground" aria-live="polite">
          {t("map.entryCount", { count: data.features.length })}
        </p>
      )}
    </div>
  );
}
