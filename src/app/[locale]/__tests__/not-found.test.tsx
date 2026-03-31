import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import "./setup";
import NotFoundPage from "../not-found";

afterEach(cleanup);

describe("NotFoundPage", () => {
  it("renders 404 text", () => {
    render(<NotFoundPage />);
    expect(screen.getByText("404")).toBeInTheDocument();
  });

  it("renders page not found title", () => {
    render(<NotFoundPage />);
    expect(screen.getByText("Page Not Found")).toBeInTheDocument();
  });

  it("renders description", () => {
    render(<NotFoundPage />);
    expect(
      screen.getByText(
        /The page you are looking for doesn't exist/,
      ),
    ).toBeInTheDocument();
  });

  it("renders back home link", () => {
    render(<NotFoundPage />);
    const link = screen.getByText("Go Back Home");
    expect(link.closest("a")).toHaveAttribute("href", "/");
  });
});
