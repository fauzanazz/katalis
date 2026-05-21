import { afterEach, describe, expect, it } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { InterestInsights, type InterestInsightsData } from "./InterestInsights";
import type { InterestKey } from "@/lib/interests/taxonomy";

const populatedInsights: InterestInsightsData = {
  topInterests: [
    {
      interestKey: "science" as InterestKey,
      score: 0.86,
      confidence: 0.9,
      trend: "rising" as const,
      signalCount: 7,
      lastSignalAt: "2026-05-10T09:00:00.000Z",
      summary: "Enjoys experiments and asks many questions.",
    },
  ],
  recentSignals: [
    {
      interestKey: "science" as InterestKey,
      source: "quest_completed",
      dimension: "engagement",
      strength: 0.75,
      observedAt: "2026-05-11T09:00:00.000Z",
    },
  ],
  suggestedNextQuestions: ["What experiment do you want to do next?"],
};

describe("InterestInsights", () => {
  afterEach(() => cleanup());

  it("renders cards, trend/confidence, audit table, and suggested questions", () => {
    render(<InterestInsights insights={populatedInsights} />);

    expect(screen.getByText("Interest patterns over time")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Signals from discoveries, quests, missions, reflections, and ratings.",
      ),
    ).toBeInTheDocument();

    expect(screen.getAllByText("Science").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Trend: rising")).toBeInTheDocument();
    expect(screen.getByText("Confidence: 90%")) .toBeInTheDocument();
    expect(screen.getByText("Signals: 7")).toBeInTheDocument();
    expect(screen.getByText("Last observed: 2026-05-10")).toBeInTheDocument();

    expect(screen.getByRole("columnheader", { name: "Date" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Interest" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Source" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Signal" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Strength" })).toBeInTheDocument();

    expect(screen.getByText("Engagement")).toBeInTheDocument();
    expect(screen.getByText("0.75")).toBeInTheDocument();

    expect(screen.getByText("Suggested questions")).toBeInTheDocument();
    expect(
      screen.getByText("What experiment do you want to do next?"),
    ).toBeInTheDocument();
  });

  it("renders empty state when no insight data", () => {
    render(
      <InterestInsights
        insights={{
          topInterests: [],
          recentSignals: [],
          suggestedNextQuestions: [],
        }}
      />,
    );

    expect(screen.getByText("Interest patterns over time")).toBeInTheDocument();
    expect(
      screen.getByText(
        "No interest signals yet. Complete discoveries, quests, and mission ratings to build trends.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText("Suggested questions")).not.toBeInTheDocument();
  });
});
