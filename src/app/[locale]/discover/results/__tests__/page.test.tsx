import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

// Mock next-intl
vi.mock("next-intl", () => {
  const translations: Record<string, string> = {
    "discover.results.pageTitle": "Your Talents Discovered!",
    "discover.results.pageSubtitle": "Here's what makes you amazing:",
    "discover.results.talentCardLabel": "Talent: {name}",
    "discover.results.confidenceLabel": "{name} confidence: {percent}%",
    "discover.results.discoverAgain": "Discover More Talents",
    "discover.results.viewHistory": "View All Discoveries",
    "discover.results.share": "Share Results",
    "discover.results.shareTitle": "My Talent Discovery Results",
    "discover.results.shareCopied": "Link copied!",
    "discover.results.shareError": "Could not copy the link.",
    "discover.results.backToDiscover": "Back to Discover",
    "discover.results.loading": "Loading your results...",
    "discover.results.notFound": "Discovery not found",
    "discover.results.notFoundDesc": "We couldn't find this discovery.",
    "discover.results.artifactType": "Image Discovery",
    "discover.results.storyType": "Story Discovery",
    "discover.results.audioType": "Voice Discovery",
    "discover.results.dateLabel": "Discovered on {date}",
    "discover.results.export": "Save as Image",
  };

  return {
    useTranslations: (namespace?: string) => {
      return (key: string, params?: Record<string, unknown>) => {
        const fullKey = namespace ? `${namespace}.${key}` : key;
        let value = translations[fullKey] || fullKey;
        if (params) {
          Object.entries(params).forEach(([k, v]) => {
            value = value.replace(`{${k}}`, String(v));
          });
        }
        return value;
      };
    },
    useLocale: () => "en",
  };
});

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "disc-1", locale: "en" }),
  useRouter: () => ({
    push: vi.fn(),
    back: vi.fn(),
    replace: vi.fn(),
  }),
  usePathname: () => "/en/discover/results/disc-1",
}));

// Mock i18n navigation
vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href} data-testid={`link-${href}`}>
      {children}
    </a>
  ),
  useRouter: () => ({
    push: vi.fn(),
    back: vi.fn(),
    replace: vi.fn(),
  }),
  usePathname: () => "/en/discover/results/disc-1",
}));

import DiscoveryResultsPage from "../../results/[id]/page";

const mockTalents = [
  {
    name: "Engineering & Mechanics",
    confidence: 0.92,
    reasoning: "The drawing shows remarkable attention to mechanical details.",
  },
  {
    name: "Spatial Reasoning",
    confidence: 0.78,
    reasoning: "The proportions are consistent and perspective maintained.",
  },
];

const mockResult = {
  id: "disc-1",
  type: "artifact",
  fileUrl: null,
  talents: mockTalents,
  createdAt: new Date().toISOString(),
};

describe("DiscoveryResultsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading state initially", () => {
    global.fetch = vi.fn().mockReturnValue(new Promise(() => {}));
    render(<DiscoveryResultsPage />);
    expect(screen.getAllByText("Loading your results...").length).toBeGreaterThanOrEqual(1);
  });

  it("renders talent cards with name, confidence bar, and reasoning", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResult),
    });

    render(<DiscoveryResultsPage />);

    await waitFor(() => {
      expect(screen.getAllByText("Engineering & Mechanics").length).toBeGreaterThanOrEqual(1);
    });

    expect(screen.getAllByText("Spatial Reasoning").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("92%").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("78%").length).toBeGreaterThanOrEqual(1);
    expect(
      screen.getAllByText(
        "The drawing shows remarkable attention to mechanical details.",
      ).length,
    ).toBeGreaterThanOrEqual(1);

    // Check progress bars exist with ARIA
    const progressBars = screen.getAllByRole("progressbar");
    expect(progressBars.length).toBeGreaterThanOrEqual(2);
  });

  it("renders talent cards with screen reader labels", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResult),
    });

    render(<DiscoveryResultsPage />);

    await waitFor(() => {
      expect(screen.getAllByText("Engineering & Mechanics").length).toBeGreaterThanOrEqual(1);
    });

    // Find talent card articles specifically by their aria-label prefix
    const articles = screen.getAllByRole("article");
    const talentArticles = articles.filter(
      (a) => a.getAttribute("aria-label")?.startsWith("Talent:"),
    );
    expect(talentArticles.length).toBeGreaterThanOrEqual(2);
    // Verify at least one has the expected label
    const hasEngineering = talentArticles.some(
      (a) => a.getAttribute("aria-label") === "Talent: Engineering & Mechanics",
    );
    expect(hasEngineering).toBe(true);
  });

  it("shows not found state for invalid discovery", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 });

    render(<DiscoveryResultsPage />);

    await waitFor(() => {
      expect(screen.getAllByText("Discovery not found").length).toBeGreaterThanOrEqual(1);
    });
  });

  it("has discover again and view history links", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResult),
    });

    render(<DiscoveryResultsPage />);

    await waitFor(() => {
      expect(screen.getAllByText("Engineering & Mechanics").length).toBeGreaterThanOrEqual(1);
    });

    // Verify links exist via test IDs
    expect(screen.getAllByTestId("link-/discover").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByTestId("link-/discover/history").length).toBeGreaterThanOrEqual(1);
  });

  it("has share button", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResult),
    });

    render(<DiscoveryResultsPage />);

    await waitFor(() => {
      expect(screen.getAllByText("Engineering & Mechanics").length).toBeGreaterThanOrEqual(1);
    });

    expect(screen.getAllByText("Share Results").length).toBeGreaterThanOrEqual(1);
  });

  it("is deep-linkable (fetches discovery by id from URL params)", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResult),
    });

    render(<DiscoveryResultsPage />);

    await waitFor(() => {
      expect(screen.getAllByText("Engineering & Mechanics").length).toBeGreaterThanOrEqual(1);
    });

    expect(global.fetch).toHaveBeenCalledWith("/api/discovery/disc-1");
  });

  it("shows discovery type metadata", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResult),
    });

    render(<DiscoveryResultsPage />);

    await waitFor(() => {
      expect(screen.getAllByText("Engineering & Mechanics").length).toBeGreaterThanOrEqual(1);
    });

    expect(screen.getAllByText("Image Discovery").length).toBeGreaterThanOrEqual(1);
  });
});
