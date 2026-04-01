import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

// Mock react-map-gl/maplibre
vi.mock("react-map-gl/maplibre", () => {
  const Map = ({
    children,
    onLoad,
    style,
  }: {
    children?: React.ReactNode;
    onLoad?: () => void;
    style?: React.CSSProperties;
  }) => {
    if (onLoad) {
      setTimeout(onLoad, 0);
    }
    return (
      <div data-testid="map-container" style={style}>
        {children}
      </div>
    );
  };

  const NavigationControl = () => (
    <div data-testid="navigation-control" />
  );
  const Popup = ({
    children,
  }: {
    children?: React.ReactNode;
  }) => <div data-testid="map-popup">{children}</div>;
  const Source = ({
    children,
  }: {
    children?: React.ReactNode;
  }) => <div data-testid="map-source">{children}</div>;
  const Layer = ({ id }: { id: string }) => (
    <div data-testid={`map-layer-${id}`} />
  );
  const GeolocateControl = () => (
    <div data-testid="geolocate-control" />
  );

  return {
    __esModule: true,
    default: Map,
    NavigationControl,
    Popup,
    Source,
    Layer,
    GeolocateControl,
  };
});

// Mock next-intl
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, params?: Record<string, unknown>) => {
    const translations: Record<string, string> = {
      "map.loading": "Loading gallery map...",
      "map.loadingTiles": "Loading map tiles...",
      "map.ariaLabel": "Interactive world map",
      "map.error": "Map could not be loaded",
      "map.noEntries": "No works yet",
      "map.webglFallback": "Your browser does not support interactive maps.",
      "map.viewDetail": "View Details",
      "map.pinImageAlt": `${params?.category} work from ${params?.country}`,
      "map.legendLabel": "Talent categories",
      "map.entryCount": `${params?.count} works on the map`,
    };
    return translations[key] || key;
  },
}));

// Mock i18n navigation
vi.mock("@/i18n/navigation", () => ({
  Link: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
    className?: string;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import { GalleryMap } from "../GalleryMap";
import type { GalleryEntryFeatureCollection } from "@/types/gallery";

const sampleData: GalleryEntryFeatureCollection = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [106.85, -6.21],
      },
      properties: {
        id: "g-1",
        imageUrl: "/api/storage/images/work-1.jpg",
        talentCategory: "Engineering",
        country: "Indonesia",
        questContext: { dream: "Build robots" },
        createdAt: "2024-01-01T00:00:00.000Z",
      },
    },
    {
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [138.3, 36.2],
      },
      properties: {
        id: "g-2",
        imageUrl: "/api/storage/images/work-2.jpg",
        talentCategory: "Art",
        country: "Japan",
        questContext: { dream: "Paint the world" },
        createdAt: "2024-01-02T00:00:00.000Z",
      },
    },
  ],
};

describe("GalleryMap", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock WebGL support
    HTMLCanvasElement.prototype.getContext = vi
      .fn()
      .mockReturnValue({ drawArrays: vi.fn() });
  });

  afterEach(() => {
    cleanup();
  });

  it("renders loading state when isLoading is true", () => {
    render(<GalleryMap data={null} isLoading={true} />);
    expect(screen.getByText("Loading gallery map...")).toBeInTheDocument();
  });

  it("renders map container when data is provided", () => {
    render(<GalleryMap data={sampleData} isLoading={false} />);
    expect(screen.getAllByTestId("map-container").length).toBeGreaterThanOrEqual(1);
  });

  it("renders navigation controls", () => {
    render(<GalleryMap data={sampleData} isLoading={false} />);
    expect(screen.getAllByTestId("navigation-control").length).toBeGreaterThanOrEqual(1);
  });

  it("renders source and layers when data has features", () => {
    render(<GalleryMap data={sampleData} isLoading={false} />);
    expect(screen.getAllByTestId("map-source").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByTestId("map-layer-clusters").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByTestId("map-layer-cluster-count").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByTestId("map-layer-unclustered-point").length).toBeGreaterThanOrEqual(1);
  });

  it("does not render source when data has no features", () => {
    const emptyData: GalleryEntryFeatureCollection = {
      type: "FeatureCollection",
      features: [],
    };
    render(<GalleryMap data={emptyData} isLoading={false} />);
    // Map container should exist but source should not
    expect(screen.getAllByTestId("map-container").length).toBeGreaterThanOrEqual(1);
    expect(screen.queryAllByTestId("map-source")).toHaveLength(0);
  });

  it("renders talent category legend", () => {
    render(<GalleryMap data={sampleData} isLoading={false} />);
    const engineeringLabels = screen.getAllByText("Engineering");
    const artLabels = screen.getAllByText("Art");
    expect(engineeringLabels.length).toBeGreaterThanOrEqual(1);
    expect(artLabels.length).toBeGreaterThanOrEqual(1);
  });

  it("has proper ARIA attributes for accessibility", () => {
    render(<GalleryMap data={sampleData} isLoading={false} />);
    const mapContainers = screen.getAllByRole("application");
    expect(mapContainers.length).toBeGreaterThanOrEqual(1);
    expect(mapContainers[0]).toHaveAttribute("aria-label", "Interactive world map");
  });

  it("renders loading state with proper role attribute", () => {
    render(<GalleryMap data={null} isLoading={true} />);
    const statusElements = screen.getAllByRole("status");
    expect(statusElements.length).toBeGreaterThanOrEqual(1);
  });

  it("renders WebGL fallback grid view when WebGL not supported", () => {
    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue(null);
    render(<GalleryMap data={sampleData} isLoading={false} />);
    expect(
      screen.getByText("Your browser does not support interactive maps."),
    ).toBeInTheDocument();
  });

  it("renders fallback grid entries with links", () => {
    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue(null);
    render(<GalleryMap data={sampleData} isLoading={false} />);
    const links = screen.getAllByRole("link");
    expect(links.length).toBeGreaterThanOrEqual(2);
    expect(links[0]).toHaveAttribute("href", "/gallery/g-1");
  });

  it("renders empty state message in WebGL fallback when no data", () => {
    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue(null);
    const emptyData: GalleryEntryFeatureCollection = {
      type: "FeatureCollection",
      features: [],
    };
    render(<GalleryMap data={emptyData} isLoading={false} />);
    expect(screen.getByText("No works yet")).toBeInTheDocument();
  });

  it("renders map with proper style dimensions", () => {
    render(<GalleryMap data={sampleData} isLoading={false} />);
    const maps = screen.getAllByTestId("map-container");
    expect(maps[0].style.width).toBe("100%");
  });

  it("renders images with alt text in fallback view", () => {
    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue(null);
    render(<GalleryMap data={sampleData} isLoading={false} />);
    const images = screen.getAllByRole("img");
    images.forEach((img) => {
      expect(img).toHaveAttribute("alt");
      expect(img.getAttribute("alt")).not.toBe("");
    });
  });
});
