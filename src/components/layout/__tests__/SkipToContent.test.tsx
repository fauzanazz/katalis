import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import "./setup";
import { SkipToContent } from "../SkipToContent";

afterEach(cleanup);

describe("SkipToContent", () => {
  it("renders skip-to-content link", () => {
    render(<SkipToContent />);
    const link = screen.getByText("Skip to content");
    expect(link).toBeInTheDocument();
  });

  it("links to #main-content", () => {
    render(<SkipToContent />);
    const link = screen.getByText("Skip to content");
    expect(link).toHaveAttribute("href", "#main-content");
  });

  it("is visually hidden by default (sr-only)", () => {
    render(<SkipToContent />);
    const link = screen.getByText("Skip to content");
    expect(link.className).toContain("sr-only");
  });
});
