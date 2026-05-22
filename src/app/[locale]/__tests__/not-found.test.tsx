import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import "./setup";

vi.mock("next-intl/server", () => ({
  getTranslations: async () => {
    const translations: Record<string, string> = {
      title: "Page Not Found",
      description:
        "Oops! The page you are looking for doesn't exist or has been moved.",
      backHome: "Go Back Home",
      backToDiscovery: "Back to Discovery",
      backToDashboard: "Back to Dashboard",
    };
    return (key: string) => translations[key] ?? key;
  },
}));

vi.mock("@/lib/auth", () => ({
  getSession: async () => null,
}));

vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => {
    const safeProps = { ...props } as Record<string, unknown>;
    delete safeProps.priority;
    delete safeProps.fill;
    // eslint-disable-next-line @next/next/no-img-element
    return <img {...(safeProps as React.ImgHTMLAttributes<HTMLImageElement>)} alt={String(props.alt ?? "")} />;
  },
}));

import NotFoundPage from "../not-found";

afterEach(cleanup);

describe("NotFoundPage", () => {
  it("renders page not found title", async () => {
    const ui = await NotFoundPage();
    render(ui);
    expect(screen.getByText("Page Not Found")).toBeInTheDocument();
  });

  it("renders description", async () => {
    const ui = await NotFoundPage();
    render(ui);
    expect(
      screen.getByText(/The page you are looking for doesn't exist/),
    ).toBeInTheDocument();
  });

  it("renders back home link for guests", async () => {
    const ui = await NotFoundPage();
    render(ui);
    const link = screen.getByText("Go Back Home");
    expect(link.closest("a")).toHaveAttribute("href", "/");
  });
});
