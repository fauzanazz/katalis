import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

const mockUsePathname = vi.fn();

vi.mock("@/i18n/navigation", () => ({
  usePathname: () => mockUsePathname(),
}));

vi.mock("@/components/layout/Header", () => ({
  Header: () => <div data-testid="global-header">Header</div>,
}));

vi.mock("@/components/layout/Footer", () => ({
  Footer: () => <div data-testid="global-footer">Footer</div>,
}));

vi.mock("@/components/layout/Breadcrumbs", () => ({
  Breadcrumbs: () => <div data-testid="breadcrumbs">Breadcrumbs</div>,
}));

vi.mock("@/components/layout/SkipToContent", () => ({
  SkipToContent: () => <div data-testid="skip-link">Skip</div>,
}));

import { LocaleShell } from "../LocaleShell";

describe("LocaleShell", () => {
  it("hides the global chrome on the landing page", () => {
    mockUsePathname.mockReturnValue("/");

    render(
      <LocaleShell isAuthenticated={false}>
        <div>Landing content</div>
      </LocaleShell>,
    );

    expect(screen.queryByTestId("global-header")).not.toBeInTheDocument();
    expect(screen.queryByTestId("breadcrumbs")).not.toBeInTheDocument();
    expect(screen.queryByTestId("global-footer")).not.toBeInTheDocument();
  });

  it("hides the global chrome on locale root paths", () => {
    mockUsePathname.mockReturnValue("/zh");

    render(
      <LocaleShell isAuthenticated={false}>
        <div>Landing content</div>
      </LocaleShell>,
    );

    expect(screen.queryByTestId("global-header")).not.toBeInTheDocument();
    expect(screen.queryByTestId("breadcrumbs")).not.toBeInTheDocument();
    expect(screen.queryByTestId("global-footer")).not.toBeInTheDocument();
  });
});
