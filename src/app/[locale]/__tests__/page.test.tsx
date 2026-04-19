import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("@/i18n/navigation", () => ({
  Link: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/components/landing/HomeLanding", () => ({
  HomeLanding: () => <div data-testid="home-landing">Home landing</div>,
}));

import LandingPage from "../page";

describe("LandingPage", () => {
  it("renders the new home landing component", () => {
    render(<LandingPage />);

    expect(screen.getByTestId("home-landing")).toBeInTheDocument();
  });
});
