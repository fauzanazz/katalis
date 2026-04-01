import "./setup";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { AnalysisError } from "../AnalysisError";

afterEach(cleanup);

describe("AnalysisError", () => {
  it("renders general error message", () => {
    render(<AnalysisError errorType="ai_failure" onRetry={() => {}} />);
    expect(
      screen.getByText(
        "Oops! We couldn't analyze your creation right now.",
      ),
    ).toBeDefined();
  });

  it("renders timeout error message", () => {
    render(<AnalysisError errorType="timeout" onRetry={() => {}} />);
    expect(
      screen.getByText(
        "The analysis is taking a bit too long. Let's try again!",
      ),
    ).toBeDefined();
  });

  it("renders network error message", () => {
    render(<AnalysisError errorType="network" onRetry={() => {}} />);
    expect(
      screen.getByText("It seems you're not connected."),
    ).toBeDefined();
  });

  it("renders retry button", () => {
    render(<AnalysisError errorType="ai_failure" onRetry={() => {}} />);
    const buttons = screen.getAllByRole("button");
    const retryButton = buttons.find((b) => b.textContent?.includes("Try Again"));
    expect(retryButton).toBeDefined();
  });

  it("calls onRetry when retry button is clicked", () => {
    const onRetry = vi.fn();
    render(<AnalysisError errorType="ai_failure" onRetry={onRetry} />);
    const buttons = screen.getAllByRole("button");
    const retryButton = buttons.find((b) => b.textContent?.includes("Try Again"));
    expect(retryButton).toBeDefined();
    fireEvent.click(retryButton!);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("has alert role for accessibility", () => {
    render(<AnalysisError errorType="ai_failure" onRetry={() => {}} />);
    expect(screen.getByRole("alert")).toBeDefined();
  });

  it("shows encouraging hint text", () => {
    render(<AnalysisError errorType="ai_failure" onRetry={() => {}} />);
    expect(
      screen.getByText(
        "Don't worry, your upload is safe. Just tap the button to try again!",
      ),
    ).toBeDefined();
  });
});
