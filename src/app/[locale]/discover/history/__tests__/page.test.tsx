import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";

// Mock next-intl
vi.mock("next-intl", () => {
  const translations: Record<string, string> = {
    "discover.history.title": "Your Discoveries",
    "discover.history.subtitle": "Look at all the amazing talents you've found!",
    "discover.history.empty": "No discoveries yet!",
    "discover.history.emptyDesc":
      "Start your first discovery to uncover your amazing talents.",
    "discover.history.startFirst": "Start Discovering",
    "discover.history.loadMore": "Load More",
    "discover.history.talentSummary": "{count} talents found",
    "discover.history.artifact": "Image Discovery",
    "discover.history.story": "Story Discovery",
    "discover.history.audio": "Voice Discovery",
    "discover.history.viewDetails": "View Details",
    "discover.history.totalDiscoveries": "{count} discoveries so far",
    "discover.results.loading": "Loading your results...",
    "discover.results.discoverAgain": "Discover More Talents",
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
  useParams: () => ({ locale: "en" }),
  useRouter: () => ({
    push: vi.fn(),
    back: vi.fn(),
    replace: vi.fn(),
  }),
  usePathname: () => "/en/discover/history",
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
  usePathname: () => "/en/discover/history",
}));

import DiscoveryHistoryPage from "../../history/page";

const mockTalents = [
  {
    name: "Engineering & Mechanics",
    confidence: 0.92,
    reasoning: "Remarkable attention to mechanical details.",
  },
  {
    name: "Spatial Reasoning",
    confidence: 0.78,
    reasoning: "Consistent proportions.",
  },
];

describe("DiscoveryHistoryPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading state initially", () => {
    global.fetch = vi.fn().mockReturnValue(new Promise(() => {}));
    render(<DiscoveryHistoryPage />);
    expect(screen.getByText("Loading your results...")).toBeInTheDocument();
  });

  it("shows empty state with encouraging message when no discoveries", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          discoveries: [],
          total: 0,
          page: 1,
          limit: 10,
        }),
    });

    render(<DiscoveryHistoryPage />);

    await waitFor(() => {
      expect(screen.getByText("No discoveries yet!")).toBeInTheDocument();
    });
    expect(
      screen.getByText(
        "Start your first discovery to uncover your amazing talents.",
      ),
    ).toBeInTheDocument();
    // Start Discovering button appears at least once
    const buttons = screen.getAllByText("Start Discovering");
    expect(buttons.length).toBeGreaterThanOrEqual(1);
  });

  it("shows discoveries with talent summaries", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          discoveries: [
            {
              id: "disc-2",
              type: "story",
              fileUrl: null,
              talents: [mockTalents[0]],
              createdAt: "2024-02-01T10:00:00Z",
            },
            {
              id: "disc-1",
              type: "artifact",
              fileUrl: "http://test.com/img.jpg",
              talents: mockTalents,
              createdAt: "2024-01-15T10:00:00Z",
            },
          ],
          total: 2,
          page: 1,
          limit: 10,
        }),
    });

    render(<DiscoveryHistoryPage />);

    await waitFor(() => {
      expect(screen.getByText("Your Discoveries")).toBeInTheDocument();
    });

    // Check discovery types exist (may have duplicates from Link wrapper)
    expect(screen.getAllByText("Story Discovery").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Image Discovery").length).toBeGreaterThanOrEqual(1);

    // Check talent name tags
    const tagElements = screen.getAllByText("Engineering & Mechanics");
    expect(tagElements.length).toBeGreaterThanOrEqual(1);

    // Check total count
    expect(screen.getByText("2 discoveries so far")).toBeInTheDocument();
  });

  it("shows load more button when there are more discoveries", async () => {
    const discoveries = Array.from({ length: 10 }, (_, i) => ({
      id: `disc-${i}`,
      type: "artifact" as const,
      fileUrl: null,
      talents: [mockTalents[0]],
      createdAt: new Date(2024, 1, 10 - i).toISOString(),
    }));

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          discoveries,
          total: 15,
          page: 1,
          limit: 10,
        }),
    });

    render(<DiscoveryHistoryPage />);

    await waitFor(() => {
      const loadMoreButtons = screen.getAllByText("Load More");
      expect(loadMoreButtons.length).toBeGreaterThanOrEqual(1);
    });
  });

  it("loads more discoveries when load more is clicked", async () => {
    const user = userEvent.setup();
    const initialDiscoveries = Array.from({ length: 10 }, (_, i) => ({
      id: `disc-${i}`,
      type: "artifact" as const,
      fileUrl: null,
      talents: [mockTalents[0]],
      createdAt: new Date(2024, 1, 10 - i).toISOString(),
    }));

    let callCount = 0;
    global.fetch = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              discoveries: initialDiscoveries,
              total: 15,
              page: 1,
              limit: 10,
            }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            discoveries: [
              {
                id: "disc-extra",
                type: "story",
                fileUrl: null,
                talents: [mockTalents[1]],
                createdAt: "2024-01-01T10:00:00Z",
              },
            ],
            total: 15,
            page: 2,
            limit: 10,
          }),
      });
    });

    render(<DiscoveryHistoryPage />);

    await waitFor(() => {
      expect(screen.getAllByText("Load More").length).toBeGreaterThanOrEqual(1);
    });

    // Click the first load more button found
    const loadMoreBtn = screen.getAllByRole("button").find(
      (btn) => btn.textContent === "Load More",
    );
    expect(loadMoreBtn).toBeDefined();
    await user.click(loadMoreBtn!);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });

  it("has discover again button when discoveries exist", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          discoveries: [
            {
              id: "disc-1",
              type: "artifact",
              fileUrl: null,
              talents: mockTalents,
              createdAt: new Date().toISOString(),
            },
          ],
          total: 1,
          page: 1,
          limit: 10,
        }),
    });

    render(<DiscoveryHistoryPage />);

    await waitFor(() => {
      const buttons = screen.getAllByText("Discover More Talents");
      expect(buttons.length).toBeGreaterThanOrEqual(1);
    });
  });

  it("discovery cards have screen reader accessible labels", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          discoveries: [
            {
              id: "disc-1",
              type: "artifact",
              fileUrl: null,
              talents: mockTalents,
              createdAt: new Date().toISOString(),
            },
          ],
          total: 1,
          page: 1,
          limit: 10,
        }),
    });

    render(<DiscoveryHistoryPage />);

    await waitFor(() => {
      const articles = screen.getAllByRole("article");
      expect(articles.length).toBeGreaterThanOrEqual(1);
      // Find article with the expected label
      const hasLabel = articles.some(
        (a) => a.getAttribute("aria-label") === "Image Discovery - 2 talents found",
      );
      expect(hasLabel).toBe(true);
    });
  });

  it("links each discovery card to its results page", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          discoveries: [
            {
              id: "disc-1",
              type: "artifact",
              fileUrl: null,
              talents: mockTalents,
              createdAt: new Date().toISOString(),
            },
          ],
          total: 1,
          page: 1,
          limit: 10,
        }),
    });

    render(<DiscoveryHistoryPage />);

    await waitFor(() => {
      const links = screen.getAllByTestId("link-/discover/results/disc-1");
      expect(links.length).toBeGreaterThanOrEqual(1);
      expect(links[0]).toHaveAttribute("href", "/discover/results/disc-1");
    });
  });
});
