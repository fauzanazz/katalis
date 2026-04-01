import { describe, it, expect, afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, cleanup } from "@testing-library/react";
import "../../../app/[locale]/quest/__tests__/setup";
import { MissionDetail, type MissionData } from "../MissionDetail";

const baseMission: MissionData = {
  id: "m1",
  day: 1,
  title: "Find materials at home",
  description:
    "Look around your house for items that could become wheels, axles, or frames for your machine.",
  instructions: [
    "Search the kitchen for bottle caps and corks",
    "Check the garage for cardboard tubes and boxes",
    "Collect rubber bands and string from drawers",
  ],
  materials: ["Cardboard boxes", "Bottle caps", "Rubber bands", "Scissors"],
  tips: [
    "Ask your parents for permission before taking things",
    "Old newspapers can be very useful too!",
  ],
  status: "available",
  proofPhotoUrl: null,
};

describe("MissionDetail", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders mission title and day label", () => {
    render(<MissionDetail mission={baseMission} />);

    expect(screen.getByText("Day 1")).toBeInTheDocument();
    expect(
      screen.getByText("Find materials at home"),
    ).toBeInTheDocument();
  });

  it("renders description section", () => {
    render(<MissionDetail mission={baseMission} />);

    expect(screen.getByText("Description")).toBeInTheDocument();
    expect(
      screen.getByText(/Look around your house/),
    ).toBeInTheDocument();
  });

  it("renders instructions as numbered steps", () => {
    render(<MissionDetail mission={baseMission} />);

    expect(screen.getByText("Instructions")).toBeInTheDocument();
    expect(
      screen.getByText("Search the kitchen for bottle caps and corks"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Check the garage for cardboard tubes and boxes"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Collect rubber bands and string from drawers"),
    ).toBeInTheDocument();

    // Step numbers
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("renders materials list", () => {
    render(<MissionDetail mission={baseMission} />);

    expect(screen.getByText("Materials Needed")).toBeInTheDocument();
    expect(screen.getByText("Cardboard boxes")).toBeInTheDocument();
    expect(screen.getByText("Bottle caps")).toBeInTheDocument();
    expect(screen.getByText("Rubber bands")).toBeInTheDocument();
    expect(screen.getByText("Scissors")).toBeInTheDocument();
  });

  it("renders tips section", () => {
    render(<MissionDetail mission={baseMission} />);

    expect(screen.getByText("Helpful Tips")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Ask your parents for permission before taking things",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Old newspapers can be very useful too!"),
    ).toBeInTheDocument();
  });

  it("shows 'no materials' message when materials array is empty", () => {
    const noMaterials = { ...baseMission, materials: [] };
    render(<MissionDetail mission={noMaterials} />);

    expect(
      screen.getByText("No special materials needed"),
    ).toBeInTheDocument();
  });

  it("shows 'no tips' message when tips array is empty", () => {
    const noTips = { ...baseMission, tips: [] };
    render(<MissionDetail mission={noTips} />);

    expect(screen.getByText("No additional tips")).toBeInTheDocument();
  });

  it("shows completed badge for completed missions", () => {
    const completed = { ...baseMission, status: "completed" };
    render(<MissionDetail mission={completed} />);

    expect(screen.getByText("Completed")).toBeInTheDocument();
  });

  it("handles long content gracefully", () => {
    const longContent = {
      ...baseMission,
      description: "A ".repeat(500) + "very long description",
      instructions: Array.from({ length: 10 }, (_, i) => `Step ${i + 1}: ${"Do something important. ".repeat(5)}`),
      materials: Array.from({ length: 15 }, (_, i) => `Material ${i + 1}`),
      tips: Array.from({ length: 8 }, (_, i) => `Tip ${i + 1}: ${"Be creative and have fun! ".repeat(3)}`),
    };

    const { container } = render(<MissionDetail mission={longContent} />);
    // Should render without errors
    expect(container).toBeTruthy();
    expect(screen.getByText(/very long description/)).toBeInTheDocument();
  });

  it("has accessible section headings", () => {
    render(<MissionDetail mission={baseMission} />);

    // Sections should have proper heading IDs for aria-labelledby
    expect(document.getElementById("mission-description")).toBeInTheDocument();
    expect(
      document.getElementById("mission-instructions"),
    ).toBeInTheDocument();
    expect(document.getElementById("mission-materials")).toBeInTheDocument();
    expect(document.getElementById("mission-tips")).toBeInTheDocument();
  });
});
