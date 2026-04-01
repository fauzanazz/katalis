import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import "../../../app/[locale]/quest/__tests__/setup";
import { QuestTimeline, type MissionSummary } from "../QuestTimeline";

const baseMissions: MissionSummary[] = [
  { id: "m1", day: 1, title: "Find materials at home", status: "completed" },
  { id: "m2", day: 2, title: "Design your machine", status: "available" },
  { id: "m3", day: 3, title: "Build a prototype", status: "locked" },
  { id: "m4", day: 4, title: "Test and improve", status: "locked" },
  { id: "m5", day: 5, title: "Add decorations", status: "locked" },
  { id: "m6", day: 6, title: "Show to friends", status: "locked" },
  { id: "m7", day: 7, title: "Document your journey", status: "locked" },
];

describe("QuestTimeline", () => {
  let onSelectDay: ReturnType<typeof vi.fn<(day: number) => void>>;

  beforeEach(() => {
    onSelectDay = vi.fn<(day: number) => void>();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders all 7 days with titles and status indicators", () => {
    render(
      <QuestTimeline
        missions={baseMissions}
        selectedDay={2}
        onSelectDay={onSelectDay}
        completedCount={1}
        totalMissions={7}
      />,
    );

    // All 7 days should be rendered
    for (let i = 1; i <= 7; i++) {
      expect(screen.getByText(`Day ${i}`)).toBeInTheDocument();
    }

    // Mission titles visible
    expect(screen.getByText("Find materials at home")).toBeInTheDocument();
    expect(screen.getByText("Design your machine")).toBeInTheDocument();
    expect(screen.getByText("Build a prototype")).toBeInTheDocument();
  });

  it("shows progress indicator reflecting completed days", () => {
    const { container } = render(
      <QuestTimeline
        missions={baseMissions}
        selectedDay={2}
        onSelectDay={onSelectDay}
        completedCount={1}
        totalMissions={7}
      />,
    );

    const progressBars = container.querySelectorAll('[role="progressbar"]');
    expect(progressBars.length).toBeGreaterThanOrEqual(1);
    expect(progressBars[0]).toHaveAttribute("aria-valuenow", "14"); // 1/7 ≈ 14%
    expect(screen.getAllByText("1 of 7 days completed").length).toBeGreaterThanOrEqual(1);
  });

  it("marks Day 1 as clickable and days 3-7 as locked", () => {
    render(
      <QuestTimeline
        missions={baseMissions}
        selectedDay={2}
        onSelectDay={onSelectDay}
        completedCount={1}
        totalMissions={7}
      />,
    );

    // Get all buttons
    const buttons = screen.getAllByRole("button");

    // Day 1 (completed) and Day 2 (available) should be enabled
    expect(buttons[0]).not.toBeDisabled(); // Day 1
    expect(buttons[1]).not.toBeDisabled(); // Day 2

    // Days 3-7 (locked) should be disabled
    expect(buttons[2]).toBeDisabled(); // Day 3
    expect(buttons[3]).toBeDisabled(); // Day 4
    expect(buttons[4]).toBeDisabled(); // Day 5
    expect(buttons[5]).toBeDisabled(); // Day 6
    expect(buttons[6]).toBeDisabled(); // Day 7
  });

  it("calls onSelectDay when clicking available/completed days", () => {
    render(
      <QuestTimeline
        missions={baseMissions}
        selectedDay={2}
        onSelectDay={onSelectDay}
        completedCount={1}
        totalMissions={7}
      />,
    );

    const buttons = screen.getAllByRole("button");

    // Click Day 1 (completed)
    fireEvent.click(buttons[0]);
    expect(onSelectDay).toHaveBeenCalledWith(1);

    // Click Day 2 (available)
    fireEvent.click(buttons[1]);
    expect(onSelectDay).toHaveBeenCalledWith(2);
  });

  it("does not call onSelectDay when clicking locked days", () => {
    render(
      <QuestTimeline
        missions={baseMissions}
        selectedDay={2}
        onSelectDay={onSelectDay}
        completedCount={1}
        totalMissions={7}
      />,
    );

    const buttons = screen.getAllByRole("button");

    // Click Day 3 (locked) - should not call
    fireEvent.click(buttons[2]);
    expect(onSelectDay).not.toHaveBeenCalled();
  });

  it("highlights the selected day", () => {
    render(
      <QuestTimeline
        missions={baseMissions}
        selectedDay={2}
        onSelectDay={onSelectDay}
        completedCount={1}
        totalMissions={7}
      />,
    );

    const buttons = screen.getAllByRole("button");
    // Day 2 should have aria-current="step"
    expect(buttons[1]).toHaveAttribute("aria-current", "step");
    // Day 1 should not
    expect(buttons[0]).not.toHaveAttribute("aria-current");
  });

  it("has accessible labels for each day", () => {
    render(
      <QuestTimeline
        missions={baseMissions}
        selectedDay={2}
        onSelectDay={onSelectDay}
        completedCount={1}
        totalMissions={7}
      />,
    );

    const buttons = screen.getAllByRole("button");
    // Each button should have an aria-label with day, title, and status
    expect(buttons[0]).toHaveAttribute(
      "aria-label",
      expect.stringContaining("Day 1"),
    );
    expect(buttons[0]).toHaveAttribute(
      "aria-label",
      expect.stringContaining("Find materials at home"),
    );
    expect(buttons[0]).toHaveAttribute(
      "aria-label",
      expect.stringContaining("Completed"),
    );
  });

  it("renders timeline navigation landmark", () => {
    render(
      <QuestTimeline
        missions={baseMissions}
        selectedDay={2}
        onSelectDay={onSelectDay}
        completedCount={1}
        totalMissions={7}
      />,
    );

    expect(
      screen.getByRole("navigation", { name: "Quest Timeline" }),
    ).toBeInTheDocument();
  });

  it("shows 100% progress when all missions completed", () => {
    const allCompleted = baseMissions.map((m) => ({
      ...m,
      status: "completed",
    }));

    const { container } = render(
      <QuestTimeline
        missions={allCompleted}
        selectedDay={1}
        onSelectDay={onSelectDay}
        completedCount={7}
        totalMissions={7}
      />,
    );

    const progressBars = container.querySelectorAll('[role="progressbar"]');
    expect(progressBars.length).toBeGreaterThanOrEqual(1);
    expect(progressBars[0]).toHaveAttribute("aria-valuenow", "100");
  });
});
