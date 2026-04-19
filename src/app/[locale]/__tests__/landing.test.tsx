import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

vi.mock("@/components/landing/HomeLanding", () => ({
  HomeLanding: () => <div data-testid="home-landing">Home landing</div>,
}));

import LandingPage from "../page";

describe("LandingPage", () => {
  it("renders the HomeLanding component", () => {
    render(<LandingPage />);
    expect(screen.getByTestId("home-landing")).toBeInTheDocument();
  });
});
