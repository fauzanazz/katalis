import "./setup";
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import { AnalysisResults } from "../AnalysisResults";
import type { AnalysisOutput } from "@/lib/ai/schemas";

afterEach(cleanup);

const mockResults: AnalysisOutput = {
  talents: [
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
  ],
};

describe("AnalysisResults", () => {
  it("renders talent names", () => {
    const { container } = render(<AnalysisResults results={mockResults} />);
    expect(container.textContent).toContain("Engineering & Mechanics");
    expect(container.textContent).toContain("Spatial Reasoning");
  });

  it("renders confidence percentages", () => {
    const { container } = render(<AnalysisResults results={mockResults} />);
    expect(container.textContent).toContain("92%");
    expect(container.textContent).toContain("78%");
  });

  it("renders reasoning text", () => {
    const { container } = render(<AnalysisResults results={mockResults} />);
    expect(container.textContent).toContain(
      "The drawing shows remarkable attention to mechanical details.",
    );
  });

  it("renders results title", () => {
    const { container } = render(<AnalysisResults results={mockResults} />);
    expect(container.textContent).toContain("Your Talents Discovered!");
  });

  it("has accessible talent card labels", () => {
    render(<AnalysisResults results={mockResults} />);
    const articles = screen.getAllByRole("article");
    expect(articles.length).toBe(2);
    expect(articles[0].getAttribute("aria-label")).toContain("Engineering & Mechanics");
    expect(articles[1].getAttribute("aria-label")).toContain("Spatial Reasoning");
  });

  it("renders confidence bars with correct ARIA attributes", () => {
    render(<AnalysisResults results={mockResults} />);
    const articles = screen.getAllByRole("article");

    const firstBar = within(articles[0]).getByRole("progressbar");
    expect(firstBar.getAttribute("aria-valuenow")).toBe("92");

    const secondBar = within(articles[1]).getByRole("progressbar");
    expect(secondBar.getAttribute("aria-valuenow")).toBe("78");
  });
});
