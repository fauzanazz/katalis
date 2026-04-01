import { describe, it, expect, afterEach, vi, beforeEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import "./setup";
import QuestNewPage from "../page";

afterEach(cleanup);

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

beforeEach(() => {
  vi.clearAllMocks();
  // Default: provide a discovery so the form is shown (no-discovery state blocks the form)
  mockFetch.mockResolvedValue({
    ok: true,
    json: async () => ({
      discoveries: [
        {
          id: "disc-default",
          talents: [
            { name: "Creative", confidence: 0.8, reasoning: "Shows creativity" },
          ],
        },
      ],
    }),
  });
});

describe("QuestNewPage", () => {
  it("renders page title", async () => {
    render(<QuestNewPage />);
    await waitFor(() => {
      expect(screen.getByText("Create Your Quest")).toBeInTheDocument();
    });
  });

  it("renders dream input with label", async () => {
    render(<QuestNewPage />);
    await waitFor(() => {
      expect(screen.getByText("What's Your Dream?")).toBeInTheDocument();
    });
    expect(screen.getByPlaceholderText(/I want to build robots/)).toBeInTheDocument();
  });

  it("renders local context input with label", async () => {
    render(<QuestNewPage />);
    await waitFor(() => {
      expect(
        screen.getByText("Tell Us About Where You Live"),
      ).toBeInTheDocument();
    });
    expect(
      screen.getByPlaceholderText(/I live in a village/),
    ).toBeInTheDocument();
  });

  it("renders generate button", async () => {
    render(<QuestNewPage />);
    await waitFor(() => {
      expect(screen.getByText("Create My Quest!")).toBeInTheDocument();
    });
  });

  it("shows no-discovery state when no discoveries exist", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ discoveries: [] }),
    });

    render(<QuestNewPage />);

    await waitFor(() => {
      expect(
        screen.getByText("Discover Your Talents First!"),
      ).toBeInTheDocument();
    });
    expect(
      screen.getByText("Start Discovering"),
    ).toBeInTheDocument();
  });

  it("shows dream empty validation error on submit", async () => {
    const user = userEvent.setup();
    render(<QuestNewPage />);

    await waitFor(() => {
      expect(screen.getByText("Create My Quest!")).toBeInTheDocument();
    });

    // Fill only context, leave dream empty
    const contextInput = screen.getByPlaceholderText(/I live in a village/);
    await user.type(contextInput, "I live in a beautiful village near a river with farms");

    const submitBtn = screen.getByText("Create My Quest!");
    await user.click(submitBtn);

    expect(screen.getByText("Please tell us your dream!")).toBeInTheDocument();
  });

  it("shows context empty validation error on submit", async () => {
    const user = userEvent.setup();
    render(<QuestNewPage />);

    await waitFor(() => {
      expect(screen.getByText("Create My Quest!")).toBeInTheDocument();
    });

    // Fill only dream, leave context empty
    const dreamInput = screen.getByPlaceholderText(/I want to build robots/);
    await user.type(dreamInput, "I want to build amazing robots");

    const submitBtn = screen.getByText("Create My Quest!");
    await user.click(submitBtn);

    expect(
      screen.getByText("Please tell us about where you live!"),
    ).toBeInTheDocument();
  });

  it("shows dream too short validation error", async () => {
    const user = userEvent.setup();
    render(<QuestNewPage />);

    await waitFor(() => {
      expect(screen.getByText("Create My Quest!")).toBeInTheDocument();
    });

    const dreamInput = screen.getByPlaceholderText(/I want to build robots/);
    await user.type(dreamInput, "short");

    const contextInput = screen.getByPlaceholderText(/I live in a village/);
    await user.type(contextInput, "I live in a beautiful village near a river with farms");

    const submitBtn = screen.getByText("Create My Quest!");
    await user.click(submitBtn);

    expect(
      screen.getByText(/at least 10 characters/),
    ).toBeInTheDocument();
  });

  it("shows context too short validation error", async () => {
    const user = userEvent.setup();
    render(<QuestNewPage />);

    await waitFor(() => {
      expect(screen.getByText("Create My Quest!")).toBeInTheDocument();
    });

    const dreamInput = screen.getByPlaceholderText(/I want to build robots/);
    await user.type(dreamInput, "I want to build amazing robots");

    const contextInput = screen.getByPlaceholderText(/I live in a village/);
    await user.type(contextInput, "short");

    const submitBtn = screen.getByText("Create My Quest!");
    await user.click(submitBtn);

    expect(
      screen.getByText(/at least 10 characters/),
    ).toBeInTheDocument();
  });

  it("shows character count for dream input", async () => {
    const user = userEvent.setup();
    render(<QuestNewPage />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/I want to build robots/)).toBeInTheDocument();
    });

    const dreamInput = screen.getByPlaceholderText(/I want to build robots/);
    await user.type(dreamInput, "Hello");

    expect(screen.getByText("5/500")).toBeInTheDocument();
  });

  it("shows character count for context input", async () => {
    const user = userEvent.setup();
    render(<QuestNewPage />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/I live in a village/)).toBeInTheDocument();
    });

    const contextInput = screen.getByPlaceholderText(/I live in a village/);
    await user.type(contextInput, "Test");

    expect(screen.getByText("4/500")).toBeInTheDocument();
  });

  it("shows loading state during quest generation", async () => {
    const user = userEvent.setup();
    // First fetch returns discovery, second one hangs for generation
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          discoveries: [{ id: "d1", talents: [{ name: "Creative", confidence: 0.8, reasoning: "test" }] }],
        }),
      })
      .mockImplementationOnce(
        () => new Promise(() => {}), // Never resolves
      );

    render(<QuestNewPage />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/I want to build robots/)).toBeInTheDocument();
    });

    const dreamInput = screen.getByPlaceholderText(/I want to build robots/);
    await user.type(dreamInput, "I want to build amazing robots");

    const contextInput = screen.getByPlaceholderText(/I live in a village/);
    await user.type(contextInput, "I live in a beautiful village near a river");

    const submitBtn = screen.getByText("Create My Quest!");
    await user.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText("Creating your quest...")).toBeInTheDocument();
    });
  });

  it("shows error state with retry button on API failure", async () => {
    const user = userEvent.setup();
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          discoveries: [{ id: "d1", talents: [{ name: "Creative", confidence: 0.8, reasoning: "test" }] }],
        }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: "ai_failure" }),
      });

    render(<QuestNewPage />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/I want to build robots/)).toBeInTheDocument();
    });

    const dreamInput = screen.getByPlaceholderText(/I want to build robots/);
    await user.type(dreamInput, "I want to build amazing robots");

    const contextInput = screen.getByPlaceholderText(/I live in a village/);
    await user.type(contextInput, "I live in a beautiful village near a river");

    const submitBtn = screen.getByText("Create My Quest!");
    await user.click(submitBtn);

    await waitFor(() => {
      expect(
        screen.getByText(
          "Oops! We couldn't create your quest right now.",
        ),
      ).toBeInTheDocument();
    });

    expect(screen.getByText("Try Again")).toBeInTheDocument();
  });

  it("preserves dream and context inputs after retry", async () => {
    const user = userEvent.setup();
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          discoveries: [{ id: "d1", talents: [{ name: "Creative", confidence: 0.8, reasoning: "test" }] }],
        }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: "ai_failure" }),
      });

    render(<QuestNewPage />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/I want to build robots/)).toBeInTheDocument();
    });

    const dreamInput = screen.getByPlaceholderText(/I want to build robots/);
    await user.type(dreamInput, "I want to build amazing robots");

    const contextInput = screen.getByPlaceholderText(/I live in a village/);
    await user.type(contextInput, "I live in a beautiful village near a river");

    const submitBtn = screen.getByText("Create My Quest!");
    await user.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText("Try Again")).toBeInTheDocument();
    });

    // Click retry
    await user.click(screen.getByText("Try Again"));

    // Inputs should still have their values
    const dreamInputAfter = screen.getByPlaceholderText(
      /I want to build robots/,
    ) as HTMLTextAreaElement;
    const contextInputAfter = screen.getByPlaceholderText(
      /I live in a village/,
    ) as HTMLTextAreaElement;
    expect(dreamInputAfter.value).toBe("I want to build amazing robots");
    expect(contextInputAfter.value).toBe(
      "I live in a beautiful village near a river",
    );
  });

  it("has proper aria attributes on form fields", async () => {
    render(<QuestNewPage />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/I want to build robots/)).toBeInTheDocument();
    });

    const dreamInput = screen.getByPlaceholderText(/I want to build robots/);
    expect(dreamInput).toHaveAttribute("id", "dream-input");
    expect(dreamInput).toHaveAttribute("aria-describedby");

    const contextInput = screen.getByPlaceholderText(/I live in a village/);
    expect(contextInput).toHaveAttribute("id", "context-input");
    expect(contextInput).toHaveAttribute("aria-describedby");
  });

  it("shows talent summary when discovery data is available", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        discoveries: [
          {
            id: "disc-1",
            talents: [
              {
                name: "Engineering & Mechanics",
                confidence: 0.92,
                reasoning: "Shows attention to mechanical details.",
              },
            ],
          },
        ],
      }),
    });

    render(<QuestNewPage />);

    await waitFor(() => {
      expect(
        screen.getByText("Your Detected Talents"),
      ).toBeInTheDocument();
      expect(
        screen.getByText("Engineering & Mechanics"),
      ).toBeInTheDocument();
    });
  });
});
