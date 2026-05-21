import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InterestInsightsClient } from "./InterestInsightsClient";

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("InterestInsightsClient", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("fetches child insights and renders InterestInsights", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        topInterests: [
          {
            interestKey: "science",
            score: 0.86,
            confidence: 0.9,
            trend: "rising",
            signalCount: 7,
            lastSignalAt: "2026-05-10T09:00:00.000Z",
            summary: null,
          },
        ],
        recentSignals: [
          {
            interestKey: "science",
            source: "quest_completed",
            dimension: "engagement",
            strength: 0.75,
            observedAt: "2026-05-11T09:00:00.000Z",
          },
        ],
        suggestedNextQuestions: ["What experiment do you want to do next?"],
      }),
    });

    render(<InterestInsightsClient childId="child-1" />);

    expect(screen.getByText("Loading interest insights...")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("Interest patterns over time")).toBeInTheDocument();
    });

    expect(mockFetch).toHaveBeenCalledWith("/api/parent/children/child-1/interests");
    expect(screen.getAllByText("Science").length).toBeGreaterThanOrEqual(1);
  });

  it("renders lightweight fallback on fetch error", async () => {
    mockFetch.mockResolvedValue({ ok: false });

    render(<InterestInsightsClient childId="child-1" />);

    await waitFor(() => {
      expect(screen.getByText("Interest insights unavailable right now.")).toBeInTheDocument();
    });
  });

  it("shows retry button on error and retries fetch on click", async () => {
    mockFetch.mockResolvedValue({ ok: false });

    render(<InterestInsightsClient childId="child-1" />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
    });

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        topInterests: [],
        recentSignals: [],
        suggestedNextQuestions: [],
      }),
    });

    await userEvent.click(screen.getByRole("button", { name: "Retry" }));

    await waitFor(() => {
      expect(screen.getByText("Interest patterns over time")).toBeInTheDocument();
    });

    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});
