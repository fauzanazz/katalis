# Interactive World Map for Next.js — Research Summary

> Researched: 2026-03-31 | Context: "Global Gallery" feature — children's artwork displayed on an interactive world map, clustered by location and talent category.

---

## 1. Library Comparison

### Mapbox GL JS
- **Rendering**: WebGL-based, smooth vector tiles, supports 3D terrain
- **React wrapper**: `react-map-gl` (maintained by Vis.gl/Uber)
- **Clustering**: Built-in source-level clustering via GeoJSON sources — no extra library needed
- **Pros**: Best documentation, largest ecosystem, beautiful default styles, built-in clustering
- **Cons**: Proprietary license (v2+), requires Mapbox access token, usage-based pricing beyond free tier
- **Cost**: **50,000 free map loads/month**; then ~$5/1,000 loads

### Leaflet (react-leaflet)
- **Rendering**: DOM/SVG-based (raster tiles by default)
- **React wrapper**: `react-leaflet` (v4+ for React 18/19)
- **Clustering**: Via plugins — `react-leaflet-cluster` or `react-leaflet-markercluster` (wraps Leaflet.markercluster)
- **Pros**: Fully open-source (BSD), huge community, simplest API, zero cost with OpenStreetMap tiles
- **Cons**: No WebGL rendering (less smooth zoom/pan at scale), SVG markers can lag with 10k+ pins, more SSR friction with Next.js
- **Cost**: **Completely free** (OSM tiles + open-source library)

### MapLibre GL JS
- **Rendering**: WebGL-based (forked from Mapbox GL JS v1, open-source)
- **React wrapper**: `react-map-gl` (same library, supports MapLibre as a drop-in backend)
- **Clustering**: Same built-in GeoJSON source clustering as Mapbox
- **Pros**: Open-source (BSD), WebGL performance, free tile providers available (MapTiler free tier: 100k loads/mo, Stadia Maps, or self-hosted), same `react-map-gl` API as Mapbox
- **Cons**: Smaller ecosystem than Mapbox, fewer built-in styles (but MapTiler/Stadia provide good ones), slightly less documentation
- **Cost**: **Library is free**; tiles depend on provider (MapTiler free tier = 100k requests/mo, Stadia Maps free tier available)

### Verdict

| Criteria | Mapbox GL JS | Leaflet | MapLibre GL JS |
|---|---|---|---|
| Performance (10k+ pins) | ★★★★★ | ★★★ | ★★★★★ |
| Cost for MVP | ★★★★ | ★★★★★ | ★★★★★ |
| Built-in clustering | ★★★★★ | ★★★ (plugin) | ★★★★★ |
| Next.js integration | ★★★★ | ★★★ | ★★★★ |
| Custom styling | ★★★★★ | ★★★★ | ★★★★ |
| Open-source | ✗ (v2+) | ✓ | ✓ |

---

## 2. Recommendation: **MapLibre GL JS + react-map-gl**

**Why**: Best balance of performance, cost, and flexibility for this use case.
- Same WebGL performance as Mapbox, but fully open-source and free
- Uses the same `react-map-gl` wrapper (mature, well-documented, Vis.gl-maintained)
- Built-in source-level clustering — no extra clustering library needed
- Free tile providers available (MapTiler free tier is generous for MVP)
- If you ever need to switch to Mapbox (e.g., for geocoding/directions), it's a one-line config change

**Fallback option**: If simplicity is paramount and pin count will stay under ~5,000, `react-leaflet` + `react-leaflet-cluster` is the simplest zero-cost option.

---

## 3. Clustering Approach

### Built-in Source Clustering (Recommended for MapLibre/Mapbox)
MapLibre/Mapbox GeoJSON sources support clustering natively at the tile/GPU level:

```tsx
<Source
  id="artworks"
  type="geojson"
  data={geojsonData}
  cluster={true}
  clusterMaxZoom={14}
  clusterRadius={50}
>
  {/* Clustered circle layer */}
  <Layer
    id="clusters"
    type="circle"
    filter={['has', 'point_count']}
    paint={{
      'circle-color': ['step', ['get', 'point_count'], '#51bbd6', 10, '#f1f075', 50, '#f28cb1'],
      'circle-radius': ['step', ['get', 'point_count'], 20, 10, 30, 50, 40]
    }}
  />
  {/* Cluster count label */}
  <Layer
    id="cluster-count"
    type="symbol"
    filter={['has', 'point_count']}
    layout={{ 'text-field': '{point_count_abbreviated}', 'text-size': 12 }}
  />
  {/* Unclustered individual points */}
  <Layer
    id="unclustered-point"
    type="circle"
    filter={['!', ['has', 'point_count']]}
    paint={{ 'circle-color': '#11b4da', 'circle-radius': 6 }}
  />
</Source>
```

**Click-to-expand** is handled via `map.getSource('artworks').getClusterExpansionZoom(clusterId)` then zooming to that level.

### Supercluster (Alternative)
`supercluster` (npm) / `use-supercluster` (React hook) is useful when:
- You need client-side clustering with custom logic (e.g., cluster by category)
- You're using Leaflet (which lacks built-in clustering at source level)
- You want to render React components as cluster markers (HTML overlays)

For MapLibre, built-in clustering is preferred — it runs on the GPU and handles 100k+ points without lag.

### Category-based Clustering
To cluster by talent category, use `clusterProperties` on the GeoJSON source:

```tsx
<Source
  id="artworks"
  type="geojson"
  data={geojsonData}
  cluster={true}
  clusterRadius={50}
  clusterProperties={{
    dance: ['+', ['case', ['==', ['get', 'category'], 'dance'], 1, 0]],
    music: ['+', ['case', ['==', ['get', 'category'], 'music'], 1, 0]],
    visual_arts: ['+', ['case', ['==', ['get', 'category'], 'visual_arts'], 1, 0]],
  }}
>
```

This lets you render donut/pie-chart cluster markers showing the category breakdown.

---

## 4. Next.js App Router Integration

### The SSR Problem
MapLibre/Mapbox/Leaflet all depend on the browser `window` object and WebGL context. They **cannot render on the server**.

### Solution: Dynamic Import with `ssr: false`

```tsx
// app/gallery/page.tsx
import dynamic from 'next/dynamic';

const GalleryMap = dynamic(() => import('@/components/GalleryMap'), {
  ssr: false,
  loading: () => <div className="h-[600px] bg-gray-100 animate-pulse" />,
});

export default function GalleryPage() {
  return <GalleryMap />;
}
```

```tsx
// components/GalleryMap.tsx
'use client';

import Map, { Source, Layer } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';

export default function GalleryMap({ artworks }: { artworks: Artwork[] }) {
  // ... map implementation
}
```

### Key Integration Notes
- The map component **must** be a Client Component (`'use client'`)
- Use `next/dynamic` with `ssr: false` in the parent page/layout
- Provide a loading skeleton for good UX during hydration
- CSS must be imported in the client component (or in a global stylesheet)
- Data fetching should happen in a Server Component, then pass data as props to the map

---

## 5. Performance Considerations

| Scale | Approach | Expected Performance |
|---|---|---|
| < 1,000 pins | Basic markers or source clustering | Excellent on all devices |
| 1,000–10,000 pins | Source-level clustering (MapLibre built-in) | Smooth on modern devices |
| 10,000–100,000 pins | Source-level clustering + viewport-based loading | Good with lazy loading |
| 100,000+ pins | Server-side pre-clustering + viewport loading | Requires backend optimization |

### Optimization Strategies
1. **Viewport-based loading**: Only fetch pins for the visible map bounds from the API
2. **GeoJSON simplification**: Pre-process data to remove unnecessary properties
3. **`useMemo`/`useCallback`**: Memoize GeoJSON data and event handlers
4. **Debounce map move events**: Don't refetch on every pixel of pan
5. **Web Workers**: Offload heavy clustering to a worker (Supercluster supports this natively)

For the MVP (likely < 10,000 artworks), **built-in source clustering will handle everything client-side without issues**.

---

## 6. Custom Pin/Marker Styling by Category

### Option A: Symbol Layers with Icons (Best Performance)
Pre-load category icons as map images, render as symbol layers:

```tsx
map.loadImage('/icons/dance.png', (err, image) => {
  map.addImage('dance-icon', image);
});

// Then use in Layer:
<Layer
  type="symbol"
  filter={['==', ['get', 'category'], 'dance']}
  layout={{ 'icon-image': 'dance-icon', 'icon-size': 0.5 }}
/>
```

### Option B: HTML Marker Overlays (Most Flexible)
Use `react-map-gl`'s `<Marker>` component for full React/CSS control:

```tsx
{artworks.map(art => (
  <Marker key={art.id} latitude={art.lat} longitude={art.lng}>
    <div className={`pin pin--${art.category}`}>
      <CategoryIcon category={art.category} />
    </div>
  </Marker>
))}
```

⚠️ HTML markers bypass WebGL — performance degrades with 500+ visible markers. Use only for unclustered individual points after zoom.

### Option C: Data-Driven Circle Styling
Use expressions to color circles by category:

```tsx
paint={{
  'circle-color': [
    'match', ['get', 'category'],
    'dance', '#FF6B6B',
    'music', '#4ECDC4',
    'visual_arts', '#45B7D1',
    'theater', '#96CEB4',
    '#888888' // fallback
  ],
  'circle-radius': 8,
  'circle-stroke-width': 2,
  'circle-stroke-color': '#ffffff'
}}
```

### Recommendation
Use **Option C (data-driven circles)** for the MVP — fast, simple, visually clear. Upgrade to **Option A (symbol icons)** when you have designed category icons. Reserve **Option B (HTML markers)** only for the detail view after clicking a cluster.

---

## 7. Packages to Install

```bash
npm install react-map-gl maplibre-gl
```

That's it. No clustering library needed — MapLibre handles it natively.

Optional:
```bash
npm install @turf/turf  # For geo calculations if needed later
```

## 8. Free Tile Providers for MapLibre

| Provider | Free Tier | Notes |
|---|---|---|
| MapTiler | 100k map loads/mo | Best styles, easy API key setup |
| Stadia Maps | 200k tiles/mo | Good alternative, no CC required |
| OpenFreeMap | Unlimited | Community project, self-hostable |
| Self-hosted (PMTiles) | Unlimited | Requires hosting your own tile files |

For MVP, **MapTiler's free tier** is the easiest to start with.

---

## Summary

**Use `react-map-gl` + `maplibre-gl` with MapTiler tiles.** This gives you:
- ✅ WebGL performance for thousands of pins
- ✅ Built-in clustering (no extra library)
- ✅ Category-aware clusters via `clusterProperties`
- ✅ Fully open-source, zero library cost
- ✅ Clean Next.js App Router integration via `dynamic()` + `'use client'`
- ✅ Easy migration path to Mapbox if needed later
- ✅ Active maintenance (`react-map-gl` v8.1+ released Oct 2025)
