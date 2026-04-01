"use client";

import { useState, useCallback, useMemo, useRef } from "react";
import Map, {
  NavigationControl,
  Popup,
  Source,
  Layer,
  MapRef,
  MapLayerMouseEvent,
  GeolocateControl,
} from "react-map-gl/maplibre";
import type { MapGeoJSONFeature, StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import {
  getTalentCategoryColor,
  DEFAULT_PIN_COLOR,
  TALENT_CATEGORY_COLORS,
} from "@/types/gallery";
import type { GalleryEntryFeatureCollection } from "@/types/gallery";

interface GalleryMapProps {
  data: GalleryEntryFeatureCollection | null;
  isLoading: boolean;
}

interface PopupInfo {
  longitude: number;
  latitude: number;
  properties: {
    id: string;
    imageUrl: string;
    talentCategory: string;
    country: string;
    questContext?: {
      questTitle?: string;
      dream?: string;
    } | null;
  };
}

const MAPTILER_KEY = process.env.NEXT_PUBLIC_MAPTILER_KEY || "mock-maptiler-key";

/**
 * Build MapTiler style URL. Falls back to a basic OSM-like style if key is invalid.
 */
function getMapStyle(): string | StyleSpecification {
  if (MAPTILER_KEY && MAPTILER_KEY !== "mock-maptiler-key") {
    return `https://api.maptiler.com/maps/streets-v2/style.json?key=${MAPTILER_KEY}`;
  }
  // Fallback to demo tiles for development
  return {
    version: 8,
    name: "Katalis Fallback Map",
    sources: {
      osm: {
        type: "raster",
        tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
        tileSize: 256,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      },
    },
    layers: [
      {
        id: "osm-tiles",
        type: "raster",
        source: "osm",
        minzoom: 0,
        maxzoom: 19,
      },
    ],
  };
}

/**
 * Get unique talent categories from data for legend.
 */
function getUniqueTalentCategories(
  data: GalleryEntryFeatureCollection | null,
): string[] {
  if (!data?.features) return [];
  const categories = new Set<string>();
  for (const feature of data.features) {
    if (feature.properties.talentCategory) {
      categories.add(feature.properties.talentCategory);
    }
  }
  return Array.from(categories).sort();
}

/**
 * Build dynamic color expression for cluster circles based on the
 * most common talent category in each cluster.
 */
function buildClusterColorExpression(): unknown[] {
  const cases: unknown[] = ["case"];
  for (const [category, color] of Object.entries(TALENT_CATEGORY_COLORS)) {
    cases.push(["==", ["get", "talentCategory"], category]);
    cases.push(color);
  }
  cases.push(DEFAULT_PIN_COLOR);
  return cases;
}

export function GalleryMap({ data, isLoading }: GalleryMapProps) {
  const t = useTranslations("gallery");
  const mapRef = useRef<MapRef | null>(null);
  const [popupInfo, setPopupInfo] = useState<PopupInfo | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);

  const mapStyle = useMemo(() => getMapStyle(), []);
  const categories = useMemo(
    () => getUniqueTalentCategories(data),
    [data],
  );

  // Check WebGL support synchronously — this is a client component only
  const webGLSupported = useMemo(() => {
    try {
      const canvas = document.createElement("canvas");
      const gl =
        canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
      return !!gl;
    } catch {
      return false;
    }
  }, []);

  const handleMapLoad = useCallback(() => {
    setMapLoaded(true);
  }, []);

  const handleMapError = useCallback((e: { error: { message?: string } }) => {
    console.error("Map error:", e);
    setMapError(e.error?.message || "Map failed to load");
  }, []);

  const handleClusterClick = useCallback(
    (e: MapLayerMouseEvent) => {
      const feature = e.features?.[0];
      if (!feature || !mapRef.current) return;

      const clusterId = feature.properties?.cluster_id;
      const source = mapRef.current.getSource("gallery-entries");
      if (!source || !("getClusterExpansionZoom" in source)) return;

      const geoJsonSource = source as { getClusterExpansionZoom: (id: number) => Promise<number> };
      geoJsonSource.getClusterExpansionZoom(clusterId).then((zoom: number) => {
        const geometry = feature.geometry;
        if (geometry.type !== "Point") return;
        mapRef.current?.easeTo({
          center: geometry.coordinates as [number, number],
          zoom: zoom,
          duration: 500,
        });
      });
    },
    [],
  );

  const handlePinClick = useCallback(
    (e: MapLayerMouseEvent) => {
      const feature = e.features?.[0];
      if (!feature) return;

      const geometry = feature.geometry;
      if (geometry.type !== "Point") return;

      const props = feature.properties;
      let questContext = props?.questContext;
      if (typeof questContext === "string") {
        try {
          questContext = JSON.parse(questContext);
        } catch {
          questContext = null;
        }
      }

      setPopupInfo({
        longitude: geometry.coordinates[0],
        latitude: geometry.coordinates[1],
        properties: {
          id: props?.id ?? "",
          imageUrl: props?.imageUrl ?? "",
          talentCategory: props?.talentCategory ?? "",
          country: props?.country ?? "",
          questContext: questContext as PopupInfo["properties"]["questContext"],
        },
      });
    },
    [],
  );

  const handleMouseEnter = useCallback(() => {
    if (mapRef.current) {
      mapRef.current.getCanvas().style.cursor = "pointer";
    }
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (mapRef.current) {
      mapRef.current.getCanvas().style.cursor = "";
    }
  }, []);

  // Handle keyboard events for accessibility
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape" && popupInfo) {
        setPopupInfo(null);
      }
    },
    [popupInfo],
  );

  // WebGL unavailable fallback
  if (!webGLSupported) {
    return <WebGLFallback data={data} />;
  }

  // Loading state
  if (isLoading) {
    return (
      <div
        className="flex h-[500px] w-full items-center justify-center rounded-lg bg-muted/50 lg:h-[600px]"
        role="status"
        aria-label={t("map.loading")}
      >
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">{t("map.loading")}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative w-full"
      onKeyDown={handleKeyDown}
      role="application"
      aria-label={t("map.ariaLabel")}
    >
      {/* Map loading overlay */}
      {!mapLoaded && !mapError && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-muted/80">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="text-sm text-muted-foreground">
              {t("map.loadingTiles")}
            </p>
          </div>
        </div>
      )}

      {/* Map error state */}
      {mapError && (
        <div className="flex h-[500px] w-full items-center justify-center rounded-lg bg-muted/50 lg:h-[600px]">
          <div className="text-center">
            <p className="text-sm text-muted-foreground">{t("map.error")}</p>
            <p className="mt-1 text-xs text-muted-foreground">{mapError}</p>
          </div>
        </div>
      )}

      <Map
        ref={mapRef}
        initialViewState={{
          longitude: 118.0,
          latitude: 0,
          zoom: 2,
        }}
        style={{
          width: "100%",
          height: "clamp(400px, 60vh, 600px)",
          borderRadius: "0.5rem",
        }}
        mapStyle={mapStyle}
        onLoad={handleMapLoad}
        onError={handleMapError}
        interactiveLayerIds={["clusters", "unclustered-point"]}
        onClick={(e) => {
          const clusterFeature = e.features?.find(
            (f: MapGeoJSONFeature) => f.layer.id === "clusters",
          );
          const pinFeature = e.features?.find(
            (f: MapGeoJSONFeature) => f.layer.id === "unclustered-point",
          );

          if (clusterFeature) {
            handleClusterClick({
              ...e,
              features: [clusterFeature],
            } as MapLayerMouseEvent);
          } else if (pinFeature) {
            handlePinClick({
              ...e,
              features: [pinFeature],
            } as MapLayerMouseEvent);
          } else {
            setPopupInfo(null);
          }
        }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        cooperativeGestures={true}
        attributionControl={{}}
        keyboard={true}
      >
        <NavigationControl position="top-right" showCompass={false} />
        <GeolocateControl position="top-right" />

        {data && data.features.length > 0 && (
          <Source
            id="gallery-entries"
            type="geojson"
            data={data}
            cluster={true}
            clusterMaxZoom={14}
            clusterRadius={50}
          >
            {/* Cluster circles */}
            <Layer
              id="clusters"
              type="circle"
              filter={["has", "point_count"]}
              paint={{
                "circle-color": "#6366F1",
                "circle-radius": [
                  "step",
                  ["get", "point_count"],
                  20,
                  10,
                  25,
                  50,
                  30,
                  100,
                  35,
                ],
                "circle-stroke-width": 2,
                "circle-stroke-color": "#ffffff",
                "circle-opacity": 0.85,
              }}
            />

            {/* Cluster count labels */}
            <Layer
              id="cluster-count"
              type="symbol"
              filter={["has", "point_count"]}
              layout={{
                "text-field": "{point_count_abbreviated}",
                "text-font": ["Open Sans Bold"],
                "text-size": 13,
                "text-allow-overlap": true,
              }}
              paint={{
                "text-color": "#ffffff",
              }}
            />

            {/* Individual (unclustered) pins */}
            <Layer
              id="unclustered-point"
              type="circle"
              filter={["!", ["has", "point_count"]]}
              paint={{
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                "circle-color": buildClusterColorExpression() as any,
                "circle-radius": 10,
                "circle-stroke-width": 2,
                "circle-stroke-color": "#ffffff",
              }}
            />
          </Source>
        )}

        {/* Pin popup */}
        {popupInfo && (
          <Popup
            longitude={popupInfo.longitude}
            latitude={popupInfo.latitude}
            onClose={() => setPopupInfo(null)}
            closeOnClick={false}
            anchor="bottom"
            maxWidth="280px"
          >
            <div className="flex flex-col gap-2 p-1">
              {popupInfo.properties.imageUrl && (
                <div className="relative aspect-video w-full overflow-hidden rounded">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={popupInfo.properties.imageUrl}
                    alt={t("map.pinImageAlt", {
                      category: popupInfo.properties.talentCategory,
                      country: popupInfo.properties.country,
                    })}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                </div>
              )}
              <div className="flex items-center gap-2">
                <span
                  className="inline-block h-3 w-3 rounded-full"
                  style={{
                    backgroundColor: getTalentCategoryColor(
                      popupInfo.properties.talentCategory,
                    ),
                  }}
                  aria-hidden="true"
                />
                <span className="text-sm font-medium">
                  {popupInfo.properties.talentCategory}
                </span>
              </div>
              {popupInfo.properties.country && (
                <p className="text-xs text-muted-foreground">
                  {popupInfo.properties.country}
                </p>
              )}
              <Link
                href={`/gallery/${popupInfo.properties.id}`}
                className="mt-1 inline-block rounded bg-primary px-3 py-1.5 text-center text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                {t("map.viewDetail")}
              </Link>
            </div>
          </Popup>
        )}
      </Map>

      {/* Talent category legend */}
      {categories.length > 0 && (
        <div
          className="mt-3 flex flex-wrap gap-3"
          role="list"
          aria-label={t("map.legendLabel")}
        >
          {categories.map((category) => (
            <div
              key={category}
              className="flex items-center gap-1.5 text-xs text-muted-foreground"
              role="listitem"
            >
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: getTalentCategoryColor(category) }}
                aria-hidden="true"
              />
              <span>{category}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Fallback grid view when WebGL is unavailable.
 */
function WebGLFallback({
  data,
}: {
  data: GalleryEntryFeatureCollection | null;
}) {
  const t = useTranslations("gallery");

  if (!data || data.features.length === 0) {
    return (
      <div className="flex h-[400px] items-center justify-center rounded-lg bg-muted/50">
        <p className="text-sm text-muted-foreground">{t("map.noEntries")}</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 rounded-lg border border-yellow-200 bg-yellow-50 p-3 dark:border-yellow-800 dark:bg-yellow-900/20">
        <p className="text-sm text-yellow-800 dark:text-yellow-200">
          {t("map.webglFallback")}
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {data.features.map((feature) => (
          <Link
            key={feature.properties.id}
            href={`/gallery/${feature.properties.id}`}
            className="group overflow-hidden rounded-lg border bg-card transition-shadow hover:shadow-md"
          >
            <div className="relative aspect-video overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={feature.properties.imageUrl}
                alt={t("map.pinImageAlt", {
                  category: feature.properties.talentCategory,
                  country: feature.properties.country,
                })}
                className="h-full w-full object-cover transition-transform group-hover:scale-105"
                loading="lazy"
              />
            </div>
            <div className="p-3">
              <div className="flex items-center gap-2">
                <span
                  className="inline-block h-3 w-3 rounded-full"
                  style={{
                    backgroundColor: getTalentCategoryColor(
                      feature.properties.talentCategory,
                    ),
                  }}
                  aria-hidden="true"
                />
                <span className="text-sm font-medium">
                  {feature.properties.talentCategory}
                </span>
              </div>
              {feature.properties.country && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {feature.properties.country}
                </p>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
