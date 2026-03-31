import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import "./setup";
import LandingPage from "../page";

afterEach(cleanup);

describe("LandingPage", () => {
  it("renders hero section with title", () => {
    render(<LandingPage />);
    expect(
      screen.getByText("Discover – Act – Connect"),
    ).toBeInTheDocument();
  });

  it("renders hero subtitle", () => {
    render(<LandingPage />);
    expect(
      screen.getByText(
        "A talent discovery and development platform for children",
      ),
    ).toBeInTheDocument();
  });

  it("renders CTA button linking to login", () => {
    render(<LandingPage />);
    const cta = screen.getByText("Get Started");
    expect(cta).toBeInTheDocument();
    expect(cta.closest("a")).toHaveAttribute("href", "/login");
  });

  it("renders three pillar sections", () => {
    render(<LandingPage />);
    const headings = screen.getAllByRole("heading", { level: 3 });
    const headingTexts = headings.map((h) => h.textContent);
    expect(headingTexts).toContain("Discover");
    expect(headingTexts).toContain("Act");
    expect(headingTexts).toContain("Connect");
  });

  it("renders pillar descriptions", () => {
    render(<LandingPage />);
    expect(
      screen.getByText(/Upload drawings, photos, or record stories/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Get a personalized 7-day quest plan/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Showcase your completed works on a global map/),
    ).toBeInTheDocument();
  });

  it("has proper heading hierarchy", () => {
    render(<LandingPage />);
    const h1 = screen.getByRole("heading", { level: 1 });
    expect(h1).toHaveTextContent("Discover – Act – Connect");

    const h3s = screen.getAllByRole("heading", { level: 3 });
    expect(h3s).toHaveLength(3);
  });
});
