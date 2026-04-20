"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useRouter, usePathname } from "@/i18n/navigation";
import { TalentCategoryFilter } from "@/components/gallery/TalentCategoryFilter";
import { ClusterBrowseView } from "@/components/gallery/ClusterBrowseView";
import { SquadBrowseView } from "@/components/gallery/SquadBrowseView";
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

type ViewMode = "map" | "clusters" | "squads";

export default function GalleryPage() {
  const t = useTranslations("gallery");
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // Read URL params for state
  const urlCategory = searchParams.get("category");
  const urlCluster = searchParams.get("cluster");
  const urlView = searchParams.get("view") as ViewMode | null;
  const urlSquad = searchParams.get("squad");

  const [data, setData] = useState<GalleryEntryFeatureCollection | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(
    urlCategory,
  );
  const [viewMode, setViewMode] = useState<ViewMode>(
    urlView === "clusters" ? "clusters" : urlView === "squads" ? "squads" : "map",
  );
  const [selectedClusterId, setSelectedClusterId] = useState<string | null>(
    urlCluster,
  );
  const [selectedSquadId, setSelectedSquadId] = useState<string | null>(urlSquad);

  /**
   * Update URL search params without full navigation.
   */
  const updateUrl = useCallback(
    (params: Record<string, string | null>) => {
      const newParams = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(params)) {
        if (value === null) {
          newParams.delete(key);
        } else {
          newParams.set(key, value);
        }
      }
      const query = newParams.toString();
      const newUrl = query ? `${pathname}?${query}` : pathname;
      router.replace(newUrl, { scroll: false });
    },
    [searchParams, pathname, router],
  );

  const fetchGalleryData = useCallback(
    async (category: string | null) => {
      setIsLoading(true);
      setError(null);
      try {
        let url = "/api/gallery/entries/geojson";
        if (category) {
          url += `?talentCategory=${encodeURIComponent(category)}`;
        }
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const geojson =
          (await response.json()) as GalleryEntryFeatureCollection;
        setData(geojson);
      } catch (err) {
        console.error("Failed to fetch gallery data:", err);
        setError(
          err instanceof Error ? err.message : "Failed to load gallery data",
        );
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    fetchGalleryData(selectedCategory);
  }, [fetchGalleryData, selectedCategory]);

  /**
   * Extract unique talent categories from the full (unfiltered) data.
   */
  const [allCategories, setAllCategories] = useState<string[]>([]);
  useEffect(() => {
    // Fetch all categories once (unfiltered)
    fetch("/api/gallery/entries/geojson")
      .then((r) => r.json())
      .then((geojson: GalleryEntryFeatureCollection) => {
        const cats = new Set<string>();
        for (const feature of geojson.features) {
          if (feature.properties.talentCategory) {
            cats.add(feature.properties.talentCategory);
          }
        }
        setAllCategories(Array.from(cats).sort());
      })
      .catch(() => {
        // Silently fail — categories will be empty
      });
  }, []);

  const handleCategoryChange = useCallback(
    (category: string | null) => {
      setSelectedCategory(category);
      updateUrl({ category, cluster: null });
    },
    [updateUrl],
  );

  const handleViewModeChange = useCallback(
    (mode: ViewMode) => {
      setViewMode(mode);
      setSelectedSquadId(null);
      updateUrl({ view: mode === "map" ? null : mode, cluster: null, squad: null });
    },
    [updateUrl],
  );

  const handleClusterSelect = useCallback(
    (clusterId: string | null) => {
      setSelectedClusterId(clusterId);
      updateUrl({ cluster: clusterId });
    },
    [updateUrl],
  );

  const handleSquadSelect = useCallback(
    (squadId: string | null) => {
      setSelectedSquadId(squadId);
      updateUrl({ squad: squadId });
    },
    [updateUrl],
  );

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

      {/* View mode toggle */}
      <div className="mb-4 flex items-center gap-2" role="tablist" aria-label="Gallery view mode">
        <button
          role="tab"
          aria-selected={viewMode === "map"}
          onClick={() => handleViewModeChange("map")}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
            viewMode === "map"
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
          }`}
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
              d="M9 6.75V15m6-6v8.25m.503 3.498 4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 0 0-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0Z"
            />
          </svg>
          {t("views.map")}
        </button>
        <button
          role="tab"
          aria-selected={viewMode === "clusters"}
          onClick={() => handleViewModeChange("clusters")}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
            viewMode === "clusters"
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
          }`}
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
              d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25a2.25 2.25 0 0 1-2.25-2.25v-2.25Z"
            />
          </svg>
          {t("views.clusters")}
        </button>
        <button
          role="tab"
          aria-selected={viewMode === "squads"}
          onClick={() => handleViewModeChange("squads")}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
            viewMode === "squads"
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
          }`}
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
          </svg>
          {t("views.squads")}
        </button>
      </div>

      {/* Talent category filter (shown in map view) */}
      {viewMode === "map" && (
        <TalentCategoryFilter
          categories={allCategories}
          selectedCategory={selectedCategory}
          onCategoryChange={handleCategoryChange}
        />
      )}

      {/* Error state */}
      {error && viewMode === "map" && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-800">{error}</p>
          <button
            onClick={() => fetchGalleryData(selectedCategory)}
            className="mt-2 text-sm font-medium text-red-700 underline hover:text-red-900"
          >
            {t("retry")}
          </button>
        </div>
      )}

      {/* Map view */}
      {viewMode === "map" && (
        <>
          <GalleryMap data={data} isLoading={isLoading} />

          {/* Empty state when filter returns no results */}
          {!isLoading && data && data.features.length === 0 && (
            <div className="mt-6 rounded-lg border bg-muted/30 p-6 text-center">
              <p className="text-sm text-muted-foreground">
                {selectedCategory
                  ? t("filter.noResults")
                  : t("map.noEntries")}
              </p>
            </div>
          )}

          {/* Entry count */}
          {!isLoading && data && data.features.length > 0 && (
            <p
              className="mt-4 text-xs text-muted-foreground"
              aria-live="polite"
            >
              {t("map.entryCount", { count: data.features.length })}
            </p>
          )}
        </>
      )}

      {/* Cluster view */}
      {viewMode === "clusters" && (
        <ClusterBrowseView
          selectedClusterId={selectedClusterId}
          onClusterSelect={handleClusterSelect}
        />
      )}

      {/* Squad view */}
      {viewMode === "squads" && (
        <SquadBrowseView
          selectedSquadId={selectedSquadId}
          onSquadSelect={handleSquadSelect}
        />
      )}
    </div>
  );
}
