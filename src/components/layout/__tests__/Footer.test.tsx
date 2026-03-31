import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import "./setup";
import { Footer } from "../Footer";

afterEach(cleanup);

describe("Footer", () => {
  it("renders the tagline", () => {
    render(<Footer />);
    expect(
      screen.getByText("Empowering children to discover, act, and connect."),
    ).toBeInTheDocument();
  });

  it("renders the copyright with current year", () => {
    render(<Footer />);
    const currentYear = new Date().getFullYear();
    expect(
      screen.getByText(`© ${currentYear} Katalis. All rights reserved.`),
    ).toBeInTheDocument();
  });

  it("has contentinfo role", () => {
    render(<Footer />);
    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
  });
});
