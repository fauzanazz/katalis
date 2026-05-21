import { beforeEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MissionInterestRating } from "./MissionInterestRating";

const mockFetch = vi.fn();
global.fetch = mockFetch;

const baseProps = {
  childId: "child-1",
  missionId: "mission-1",
  interestKey: "science",
  initialRating: null,
} as const;

describe("MissionInterestRating", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    cleanup();
  });

  it("renders 5 accessible rating buttons", () => {
    render(<MissionInterestRating {...baseProps} />);

    for (let i = 1; i <= 5; i++) {
      expect(
        screen.getByRole("button", { name: `Rate interest ${i}` }),
      ).toBeInTheDocument();
    }
  });

  it("marks initialRating as selected", () => {
    render(<MissionInterestRating {...baseProps} initialRating={3} />);

    const btn3 = screen.getByRole("button", { name: "Rate interest 3" });
    expect(btn3).toHaveAttribute("aria-pressed", "true");

    const btn2 = screen.getByRole("button", { name: "Rate interest 2" });
    expect(btn2).toHaveAttribute("aria-pressed", "false");
  });

  it("disables controls while saving and shows saved on success", async () => {
    const user = userEvent.setup();
    let resolve: (value: Response) => void;
    mockFetch.mockImplementation(
      () => new Promise<Response>((r) => { resolve = r; }),
    );

    render(<MissionInterestRating {...baseProps} />);

    await user.click(screen.getByRole("button", { name: "Rate interest 4" }));

    for (let i = 1; i <= 5; i++) {
      expect(screen.getByRole("button", { name: `Rate interest ${i}` })).toBeDisabled();
    }
    expect(screen.getByText("Saving...")).toBeInTheDocument();

    resolve!({
      ok: true,
      json: async () => ({ ok: true }),
    } as Response);

    await waitFor(() => {
      expect(screen.getByText("Saved")).toBeInTheDocument();
    });

    expect(mockFetch).toHaveBeenCalledWith("/api/interests/rating", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        childId: "child-1",
        missionId: "mission-1",
        interestKey: "science",
        rating: 4,
        rater: "parent",
      }),
    });
  });

  it("shows error state when fetch returns !ok", async () => {
    const user = userEvent.setup();
    mockFetch.mockResolvedValue({ ok: false, json: async () => ({ error: "server_error" }) });

    render(<MissionInterestRating {...baseProps} />);

    await user.click(screen.getByRole("button", { name: "Rate interest 2" }));

    await waitFor(() => {
      expect(screen.getByText("Could not save rating. Try again.")).toBeInTheDocument();
    });

    // controls re-enabled after error
    for (let i = 1; i <= 5; i++) {
      expect(screen.getByRole("button", { name: `Rate interest ${i}` })).not.toBeDisabled();
    }
  });
});
