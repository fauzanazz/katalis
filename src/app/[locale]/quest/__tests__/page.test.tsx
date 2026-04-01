import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import "./setup";
import QuestListPage from "../page";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

const mockQuestList = {
  quests: [
    {
      id: "quest-1",
      dream: "I want to build robots",
      status: "active",
      createdAt: "2024-01-15T10:00:00Z",
      completedCount: 2,
      totalMissions: 7,
      missions: [
        { day: 1, title: "Find materials", status: "completed" },
        { day: 2, title: "Design your machine", status: "completed" },
        { day: 3, title: "Build a prototype", status: "available" },
        { day: 4, title: "Test and improve", status: "locked" },
        { day: 5, title: "Add decorations", status: "locked" },
        { day: 6, title: "Show to friends", status: "locked" },
        { day: 7, title: "Document journey", status: "locked" },
      ],
    },
    {
      id: "quest-2",
      dream: "I want to paint murals",
      status: "completed",
      createdAt: "2024-01-01T10:00:00Z",
      completedCount: 7,
      totalMissions: 7,
      missions: Array.from({ length: 7 }, (_, i) => ({
        day: i + 1,
        title: `Art day ${i + 1}`,
        status: "completed",
      })),
    },
  ],
};

describe("QuestListPage", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders empty state when no quests exist", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ quests: [] }),
    });

    render(<QuestListPage />);

    await waitFor(() => {
      expect(screen.getByText("No quests yet!")).toBeInTheDocument();
    });

    expect(
      screen.getByText(/Complete a talent discovery first/),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Discover Your Talents"),
    ).toBeInTheDocument();
  });

  it("renders quest list with progress", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockQuestList,
    });

    render(<QuestListPage />);

    await waitFor(() => {
      expect(
        screen.getByText("I want to build robots"),
      ).toBeInTheDocument();
    });

    expect(screen.getByText("I want to paint murals")).toBeInTheDocument();
    expect(screen.getByText("Active Quest")).toBeInTheDocument();
    expect(screen.getByText("Completed Quest")).toBeInTheDocument();
    expect(
      screen.getByText("2 of 7 days completed"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("7 of 7 days completed"),
    ).toBeInTheDocument();
  });

  it("shows progress bars for each quest", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockQuestList,
    });

    render(<QuestListPage />);

    await waitFor(() => {
      const progressBars = screen.getAllByRole("progressbar");
      expect(progressBars.length).toBe(2);
      expect(progressBars[0]).toHaveAttribute("aria-valuenow", "29"); // 2/7
      expect(progressBars[1]).toHaveAttribute("aria-valuenow", "100"); // 7/7
    });
  });

  it("shows create quest button when quests exist", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockQuestList,
    });

    render(<QuestListPage />);

    await waitFor(() => {
      expect(screen.getByText("Create a Quest")).toBeInTheDocument();
    });
  });

  it("links to quest detail pages", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockQuestList,
    });

    render(<QuestListPage />);

    await waitFor(() => {
      const links = screen.getAllByRole("link");
      const questLink = links.find(
        (l) => l.getAttribute("href") === "/quest/quest-1",
      );
      expect(questLink).toBeTruthy();
    });
  });

  it("shows loading state initially", () => {
    mockFetch.mockImplementation(
      () => new Promise(() => {}), // Never resolves
    );

    render(<QuestListPage />);

    expect(screen.getByText("Your Quests...")).toBeInTheDocument();
  });

  it("has page heading and subtitle", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ quests: [] }),
    });

    render(<QuestListPage />);

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Your Quests" }),
      ).toBeInTheDocument();
    });

    expect(
      screen.getByText("Track your 7-day adventure quests!"),
    ).toBeInTheDocument();
  });
});
