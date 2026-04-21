import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import "./setup";
import { Header } from "../Header";

afterEach(cleanup);

describe("Header", () => {
  it("renders the landing page brand label", () => {
    render(<Header isAuthenticated={false} isAdmin={false} />);
    expect(screen.getByText("Katalis AI")).toBeInTheDocument();
  });

  it("renders navigation links (Discover, Quest, Gallery)", () => {
    render(<Header isAuthenticated={false} isAdmin={false} />);
    // Desktop nav has these links, mobile has them in sheet
    const discoverLinks = screen.getAllByText("Discover");
    expect(discoverLinks.length).toBeGreaterThanOrEqual(1);
    const questLinks = screen.getAllByText("Quest");
    expect(questLinks.length).toBeGreaterThanOrEqual(1);
    const galleryLinks = screen.getAllByText("Gallery");
    expect(galleryLinks.length).toBeGreaterThanOrEqual(1);
  });

  it("renders login button when not authenticated", () => {
    render(<Header isAuthenticated={false} isAdmin={false} />);
    const loginButtons = screen.getAllByText("Login");
    expect(loginButtons.length).toBeGreaterThan(0);
  });

  it("renders logout button when authenticated", () => {
    render(<Header isAuthenticated={true} isAdmin={false} />);
    const logoutButtons = screen.getAllByText("Logout");
    expect(logoutButtons.length).toBeGreaterThan(0);
  });

  it("has banner role", () => {
    render(<Header isAuthenticated={false} isAdmin={false} />);
    expect(screen.getByRole("banner")).toBeInTheDocument();
  });

  it("has navigation landmark", () => {
    render(<Header isAuthenticated={false} isAdmin={false} />);
    const navs = screen.getAllByRole("navigation");
    expect(navs.length).toBeGreaterThanOrEqual(1);
  });

  it("uses the landing page mobile menu label", () => {
    render(<Header isAuthenticated={false} isAdmin={false} />);
    const menuButtons = screen.getAllByLabelText("Open navigation menu");
    expect(menuButtons.length).toBeGreaterThanOrEqual(1);
  });

  it("renders language switcher", () => {
    render(<Header isAuthenticated={false} isAdmin={false} />);
    const switchers = screen.getAllByLabelText("Switch Language");
    expect(switchers.length).toBeGreaterThanOrEqual(1);
  });

  it("nav links have min 44px touch targets", () => {
    render(<Header isAuthenticated={false} isAdmin={false} />);
    const navLinks = screen.getAllByText("Discover");
    navLinks.forEach((link) => {
      expect(link.className).toContain("min-h-[44px]");
    });
  });
});
