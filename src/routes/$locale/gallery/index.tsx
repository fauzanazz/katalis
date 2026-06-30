import React, { useState, useEffect, useCallback, Suspense } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { TalentCategoryFilter } from "@/components/start/gallery/TalentCategoryFilter";
import { ClusterBrowseView } from "@/components/start/gallery/ClusterBrowseView";
import { SquadBrowseView } from "@/components/start/gallery/SquadBrowseView";
import { KidPageShell } from "@/components/layout/KidPageShell";
import { LocaleLink } from "@/i18n/start-navigation";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import { getGalleryGeoJsonFn, listGalleryEntriesFn } from "@/lib/server/gallery";
import type { GalleryEntryFeatureCollection } from "@/types/gallery";

// CLIENT-ONLY: React.lazy + mounted guard + Suspense (replaces next/dynamic ssr:false)
const GalleryMap = React.lazy(() =>
  import("@/components/start/gallery/GalleryMap").then((mod) => ({ default: mod.GalleryMap })),
);

type ViewMode = "map" | "clusters" | "squads";

const VALID_VIEWS: ViewMode[] = ["map", "clusters", "squads"];

function isViewMode(v: unknown): v is ViewMode {
  return VALID_VIEWS.includes(v as ViewMode);
}

export const Route = createFileRoute("/$locale/gallery/")({
  validateSearch: (s: Record<string, unknown>) => ({
    category: typeof s.category === "string" ? s.category : undefined,
    cluster: typeof s.cluster === "string" ? s.cluster : undefined,
    view: isViewMode(s.view) ? s.view : ("clusters" as ViewMode),
    squad: typeof s.squad === "string" ? s.squad : undefined,
  }),
  loader: async () => {
    // Prefetch unfiltered GeoJSON for category chips
    try {
      const result = await getGalleryGeoJsonFn({ data: {} });
      if (!result.ok) return { prefetchedGeoJson: null };
      const { ok: _ok, ...geo } = result;
      return { prefetchedGeoJson: geo as unknown as GalleryEntryFeatureCollection };
    } catch {
      return { prefetchedGeoJson: null };
    }
  },
  head: () => ({
    meta: [
      { title: m.gallery_title() },
      { name: "description", content: m.gallery_subtitle() },
    ],
  }),
  component: GalleryPage,
});

function GalleryPage() {
  const { prefetchedGeoJson } = Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });

  const selectedCategory = search.category ?? null;
  const selectedClusterId = search.cluster ?? null;
  const viewMode: ViewMode = search.view;
  const selectedSquadId = search.squad ?? null;

  const updateSearch = useCallback(
    (updates: Partial<{ category: string | undefined; cluster: string | undefined; view: ViewMode; squad: string | undefined }>) => {
      navigate({ search: (prev) => ({ ...prev, ...updates }) });
    },
    [navigate],
  );

  // Filtered GeoJSON data for the map view
  const [data, setData] = useState<GalleryEntryFeatureCollection | null>(
    selectedCategory ? null : (prefetchedGeoJson ?? null),
  );
  const [isLoading, setIsLoading] = useState(selectedCategory ? true : false);
  const [error, setError] = useState<string | null>(null);

  // Unfiltered data for category chips
  const [allCategories, setAllCategories] = useState<string[]>(() => {
    if (!prefetchedGeoJson) return [];
    const cats = new Set<string>();
    for (const feature of prefetchedGeoJson.features) {
      if (feature.properties.talentCategory) {
        cats.add(feature.properties.talentCategory);
      }
    }
    return Array.from(cats).sort();
  });

  // Fetch unfiltered categories if not already available from loader
  useEffect(() => {
    if (allCategories.length > 0) return;
    getGalleryGeoJsonFn({ data: {} })
      .then((res) => {
        if (!res.ok) return;
        const geo = res as unknown as GalleryEntryFeatureCollection & { ok: true };
        const cats = new Set<string>();
        for (const feature of geo.features) {
          if (feature.properties.talentCategory) {
            cats.add(feature.properties.talentCategory);
          }
        }
        setAllCategories(Array.from(cats).sort());
      })
      .catch(() => {
        // Silently fail — categories will be empty
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchGalleryData = useCallback(async (category: string | null) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await getGalleryGeoJsonFn({
        data: category ? { talentCategory: category } : {},
      });
      if (!result.ok) throw new Error(result.message ?? "Failed to load gallery data");
      const { ok: _ok, ...geo } = result;
      setData(geo as unknown as GalleryEntryFeatureCollection);
    } catch (fetchErr) {
      console.error("Failed to fetch gallery data:", fetchErr);
      setError(fetchErr instanceof Error ? fetchErr.message : "Failed to load gallery data");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Refetch when category changes
  useEffect(() => {
    fetchGalleryData(selectedCategory);
  }, [fetchGalleryData, selectedCategory]);

  // Client-only mount guard for GalleryMap
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const handleCategoryChange = useCallback(
    (category: string | null) => {
      updateSearch({ category: category ?? undefined, cluster: undefined });
    },
    [updateSearch],
  );

  const handleViewModeChange = useCallback(
    (mode: ViewMode) => {
      updateSearch({
        view: mode,
        cluster: undefined,
        squad: undefined,
      });
    },
    [updateSearch],
  );

  const handleClusterSelect = useCallback(
    (clusterId: string | null) => {
      updateSearch({ cluster: clusterId ?? undefined });
    },
    [updateSearch],
  );

  const handleSquadSelect = useCallback(
    (squadId: string | null) => {
      updateSearch({ squad: squadId ?? undefined });
    },
    [updateSearch],
  );

  const [recentWorks, setRecentWorks] = useState<Array<{
    id: string;
    imageUrl: string;
    talentCategory: string;
    country: string | null;
    createdAt: Date | string;
  }>>([]);

  useEffect(() => {
    listGalleryEntriesFn({ data: { page: 1, pageSize: 20 } })
      .then((res) => {
        if (res.ok) setRecentWorks(res.entries);
      })
      .catch(() => {});
  }, []);

  const viewTabs: {
    id: ViewMode;
    label: string;
    icon: React.ReactNode;
  }[] = [
    {
      id: "map",
      label: m.gallery_views_map(),
      icon: (
        <svg
          className="h-4 w-4 shrink-0"
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
      ),
    },
    {
      id: "clusters",
      label: m.gallery_views_clusters(),
      icon: (
        <svg
          className="h-4 w-4 shrink-0"
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
      ),
    },
    {
      id: "squads",
      label: m.gallery_views_squads(),
      icon: (
        <svg
          className="h-4 w-4 shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z"
          />
        </svg>
      ),
    },
  ];

  return (
    <KidPageShell
      kicker={m.gallery_kicker()}
      title={m.gallery_title()}
      subtitle={m.gallery_subtitle()}
    >
      <nav className="mb-6 flex gap-2" role="tablist" aria-label="Gallery view mode">
        {viewTabs.map((tab) => {
          const isActive = viewMode === tab.id;
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              onClick={() => handleViewModeChange(tab.id)}
              className={cn(
                "flex flex-1 items-center gap-2 rounded-xl border-2 border-black px-4 py-3 text-sm font-black tracking-tight transition-all",
                isActive
                  ? "bg-white text-black shadow-[3px_3px_0_#000]"
                  : "bg-white/60 text-black/60 hover:bg-white hover:text-black hover:shadow-[3px_3px_0_#000]",
              )}
            >
              {tab.icon}
              <span className="hidden sm:block">{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Talent category filter (shown in map view only) */}
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
            {m.gallery_retry()}
          </button>
        </div>
      )}

      {/* Map view */}
      {viewMode === "map" && (
        <>
          {mounted && (
            <Suspense
              fallback={
                <div className="flex h-[500px] w-full items-center justify-center rounded-lg bg-muted/50 lg:h-[600px]">
                  <div className="flex flex-col items-center gap-3">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                  </div>
                </div>
              }
            >
              <GalleryMap data={data} isLoading={isLoading} />
            </Suspense>
          )}

          {/* Empty state when filter returns no results */}
          {!isLoading && data && data.features.length === 0 && (
            <div className="mt-6 rounded-lg border bg-muted/30 p-6 text-center">
              <p className="text-sm text-muted-foreground">
                {selectedCategory
                  ? m.gallery_filter_noResults()
                  : m.gallery_map_noEntries()}
              </p>
            </div>
          )}

          {/* Entry count */}
          {!isLoading && data && data.features.length > 0 && (
            <p className="mt-4 text-xs text-muted-foreground" aria-live="polite">
              {m.gallery_map_entryCount({ count: data.features.length } as never)}
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

      {/* Recent Works grid — all entries regardless of coordinates */}
      {recentWorks.length > 0 && (
        <section className="mt-8" aria-labelledby="recent-works-heading">
          <h2
            id="recent-works-heading"
            className="mb-4 text-sm font-black uppercase tracking-wider text-[color:var(--ink)]"
            style={{ fontFamily: "var(--font-montserrat)" }}
          >
            {m.gallery_recentWorks()}
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {recentWorks.map((entry) => (
              <LocaleLink
                key={entry.id}
                href={`/gallery/${entry.id}`}
                className="group relative overflow-hidden rounded-xl border-2 border-black shadow-[3px_3px_0_#000] transition-all hover:shadow-[5px_5px_0_#000]"
              >
                <div className="aspect-square w-full overflow-hidden bg-muted">
                  <img
                    src={entry.imageUrl}
                    alt={entry.talentCategory}
                    className="h-full w-full object-cover transition-transform group-hover:scale-105"
                    loading="lazy"
                  />
                </div>
                <div className="bg-white px-2 py-1.5">
                  <p className="truncate text-xs font-bold text-[color:var(--ink)]">{entry.talentCategory}</p>
                  {entry.country && (
                    <p className="truncate text-[10px] text-[color:var(--ink)]/60">{entry.country}</p>
                  )}
                </div>
              </LocaleLink>
            ))}
          </div>
        </section>
      )}
    </KidPageShell>
  );
}
