import { afterEach, describe, it, expect } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { CapabilityTrajectoryCard } from "@/components/parent/CapabilityTrajectoryCard";

afterEach(cleanup);

const snapshots = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    id: `s${i}`,
    score: 0.3 + i * 0.05,
    band: i > 4 ? "proficient" : "developing",
    createdAt: new Date(2026, 0, i + 1).toISOString(),
  }));

describe("CapabilityTrajectoryCard — Session 4 contract", () => {
  it("renders placeholder text when no snapshots exist", () => {
    render(
      <CapabilityTrajectoryCard
        childId="child-1"
        snapshots={[]}
        labels={{
          title: "Capability trajectory",
          placeholder: "We're learning…",
          bands: {
            emerging: "Emerging",
            developing: "Developing",
            proficient: "Proficient",
            extending: "Extending",
          },
        }}
      />,
    );
    expect(screen.getByText(/learning/i)).toBeInTheDocument();
  });

  it("renders current band label from the latest snapshot", () => {
    render(
      <CapabilityTrajectoryCard
        childId="child-1"
        snapshots={snapshots(6)}
        labels={{
          title: "Capability trajectory",
          placeholder: "We're learning…",
          bands: {
            emerging: "Emerging",
            developing: "Developing",
            proficient: "Proficient",
            extending: "Extending",
          },
        }}
      />,
    );
    expect(screen.getByText(/Proficient/)).toBeInTheDocument();
  });

  it("renders one chart point per snapshot (data-testid)", () => {
    render(
      <CapabilityTrajectoryCard
        childId="child-1"
        snapshots={snapshots(5)}
        labels={{
          title: "Capability trajectory",
          placeholder: "We're learning…",
          bands: {
            emerging: "Emerging",
            developing: "Developing",
            proficient: "Proficient",
            extending: "Extending",
          },
        }}
      />,
    );
    expect(screen.getAllByTestId("zpd-point")).toHaveLength(5);
  });
});
