import "./setup";
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { AnalysisLoading } from "../AnalysisLoading";

afterEach(cleanup);

describe("AnalysisLoading", () => {
  it("renders loading text", () => {
    const { container } = render(<AnalysisLoading />);
    expect(container.textContent).toContain("Analyzing your creation...");
  });

  it("renders encouraging subtext", () => {
    const { container } = render(<AnalysisLoading />);
    expect(container.textContent).toContain(
      "Our AI is looking for your unique talents and interests!",
    );
  });

  it("has accessible status role", () => {
    render(<AnalysisLoading />);
    const status = screen.getByRole("status");
    expect(status).toBeDefined();
  });
});
