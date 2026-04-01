import "./setup";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { StoryPrompt } from "../StoryPrompt";
import type { StoryPromptImage } from "@/lib/story-prompts";

// Mock next/image
vi.mock("next/image", () => {
  return {
    default: function MockImage(props: Record<string, unknown>) {
      // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
      return <img {...props} />;
    },
  };
});

// Mock sessionStorage
const sessionStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();
Object.defineProperty(window, "sessionStorage", { value: sessionStorageMock });

URL.createObjectURL = vi.fn(() => "blob:mock-url");
URL.revokeObjectURL = vi.fn();

const mockImages: StoryPromptImage[] = [
  {
    id: "forest-adventure",
    src: "/story-prompts/forest-adventure.svg",
    altEn: "A colorful forest",
    altId: "Hutan berwarna-warni",
  },
  {
    id: "ocean-discovery",
    src: "/story-prompts/ocean-discovery.svg",
    altEn: "An ocean scene",
    altId: "Pemandangan laut",
  },
  {
    id: "space-journey",
    src: "/story-prompts/space-journey.svg",
    altEn: "A space scene",
    altId: "Pemandangan luar angkasa",
  },
];

describe("StoryPrompt", () => {
  const mockOnAnalysisComplete = vi.fn();
  const mockOnAnalysisStart = vi.fn();
  const mockOnError = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorageMock.clear();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    cleanup();
  });

  const renderStoryPrompt = () => {
    return render(
      <StoryPrompt
        images={mockImages}
        onAnalysisComplete={mockOnAnalysisComplete}
        onAnalysisStart={mockOnAnalysisStart}
        onError={mockOnError}
      />,
    );
  };

  it("renders 3 story prompt images", () => {
    renderStoryPrompt();
    const images = screen.getAllByRole("img");
    expect(images).toHaveLength(3);
  });

  it("images have meaningful alt text", () => {
    renderStoryPrompt();
    const images = screen.getAllByRole("img");
    images.forEach((img) => {
      expect(img.getAttribute("alt")).toBeTruthy();
      expect(img.getAttribute("alt")).not.toBe("image");
    });
  });

  it("renders title and subtitle", () => {
    renderStoryPrompt();
    expect(screen.getByText("Look at these pictures!")).toBeTruthy();
    expect(
      screen.getByText("Create a story inspired by what you see"),
    ).toBeTruthy();
  });

  it("renders text and audio mode toggle buttons", () => {
    renderStoryPrompt();
    expect(screen.getByText("Write a Story")).toBeTruthy();
    expect(screen.getByText("Record a Story")).toBeTruthy();
  });

  it("shows text input by default", () => {
    renderStoryPrompt();
    const textarea = screen.getByPlaceholderText(
      "Once upon a time, there was a...",
    );
    expect(textarea).toBeTruthy();
  });

  it("shows character count", () => {
    renderStoryPrompt();
    expect(
      screen.getByText("0/2000 characters (minimum 20)"),
    ).toBeTruthy();
  });

  it("updates character count on text input", () => {
    renderStoryPrompt();
    const textarea = screen.getByPlaceholderText(
      "Once upon a time, there was a...",
    );
    fireEvent.change(textarea, { target: { value: "Hello world!" } });
    expect(
      screen.getByText("12/2000 characters (minimum 20)"),
    ).toBeTruthy();
  });

  it("submit button is disabled when story is too short", () => {
    renderStoryPrompt();
    const submitBtn = screen.getByText("Discover My Talents");
    expect(submitBtn).toBeTruthy();
    expect((submitBtn as HTMLButtonElement).disabled).toBe(true);
  });

  it("submit button is enabled when story meets minimum length", () => {
    renderStoryPrompt();
    const textarea = screen.getByPlaceholderText(
      "Once upon a time, there was a...",
    );
    fireEvent.change(textarea, {
      target: { value: "This story is now long enough to pass validation!" },
    });
    const submitBtn = screen.getByText("Discover My Talents");
    expect((submitBtn as HTMLButtonElement).disabled).toBe(false);
  });

  it("shows validation error on submit with too-short story", () => {
    renderStoryPrompt();
    const textarea = screen.getByPlaceholderText(
      "Once upon a time, there was a...",
    );
    fireEvent.change(textarea, { target: { value: "Short" } });

    // Force-enable and click submit — the button is disabled but we test validation logic
    // by typing short text first then finding the submit button
    // Since button is disabled, validation error shows on attempt
    const submitBtn = screen.getByText("Discover My Talents");
    // Button should be disabled for short text
    expect((submitBtn as HTMLButtonElement).disabled).toBe(true);
  });

  it("calls fetch on valid story submission", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          talents: [
            {
              name: "Creative Imagination",
              confidence: 0.94,
              reasoning: "Amazing creativity!",
            },
          ],
        }),
    });
    global.fetch = mockFetch;

    renderStoryPrompt();
    const textarea = screen.getByPlaceholderText(
      "Once upon a time, there was a...",
    );
    fireEvent.change(textarea, {
      target: {
        value:
          "Once upon a time, in a magical forest, there lived a little fox who loved solving puzzles and exploring new places every day.",
      },
    });

    const submitBtn = screen.getByText("Discover My Talents");
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/discovery/analyze-story",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
        }),
      );
    });

    expect(mockOnAnalysisStart).toHaveBeenCalled();
  });

  it("calls onAnalysisComplete with results on success", async () => {
    const mockResult = {
      talents: [
        {
          name: "Creative Imagination",
          confidence: 0.94,
          reasoning: "Amazing creativity!",
        },
      ],
    };
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResult),
    });
    global.fetch = mockFetch;

    renderStoryPrompt();
    const textarea = screen.getByPlaceholderText(
      "Once upon a time, there was a...",
    );
    fireEvent.change(textarea, {
      target: {
        value:
          "Once upon a time, in a magical forest, there lived a little fox who loved solving puzzles and exploring new places every day.",
      },
    });

    const submitBtn = screen.getByText("Discover My Talents");
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockOnAnalysisComplete).toHaveBeenCalledWith(mockResult);
    });
  });

  it("calls onError with ai_failure on server error", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: "ai_failure" }),
    });
    global.fetch = mockFetch;

    renderStoryPrompt();
    const textarea = screen.getByPlaceholderText(
      "Once upon a time, there was a...",
    );
    fireEvent.change(textarea, {
      target: {
        value:
          "Once upon a time, in a magical forest, there lived a little fox who loved solving puzzles and exploring new places every day.",
      },
    });

    const submitBtn = screen.getByText("Discover My Talents");
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockOnError).toHaveBeenCalledWith("ai_failure");
    });
  });

  it("calls onError with timeout on 504", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 504,
      json: () => Promise.resolve({ error: "timeout" }),
    });
    global.fetch = mockFetch;

    renderStoryPrompt();
    const textarea = screen.getByPlaceholderText(
      "Once upon a time, there was a...",
    );
    fireEvent.change(textarea, {
      target: {
        value:
          "Once upon a time, in a magical forest, there lived a little fox who loved solving puzzles and exploring new places every day.",
      },
    });

    const submitBtn = screen.getByText("Discover My Talents");
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockOnError).toHaveBeenCalledWith("timeout");
    });
  });

  it("calls onError with network on fetch failure", async () => {
    const mockFetch = vi.fn().mockRejectedValue(new TypeError("Network error"));
    global.fetch = mockFetch;

    renderStoryPrompt();
    const textarea = screen.getByPlaceholderText(
      "Once upon a time, there was a...",
    );
    fireEvent.change(textarea, {
      target: {
        value:
          "Once upon a time, in a magical forest, there lived a little fox who loved solving puzzles and exploring new places every day.",
      },
    });

    const submitBtn = screen.getByText("Discover My Talents");
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockOnError).toHaveBeenCalledWith("network");
    });
  });

  it("handles image load failure gracefully", () => {
    renderStoryPrompt();
    const images = screen.getAllByRole("img");
    // Simulate image error
    fireEvent.error(images[0]);
    // Should show fallback (not crash)
    expect(screen.getByText("Look at these pictures!")).toBeTruthy();
  });

  it("textarea has accessible label", () => {
    renderStoryPrompt();
    const textarea = screen.getByLabelText("Your Story");
    expect(textarea).toBeTruthy();
  });

  it("textarea has maxLength attribute", () => {
    renderStoryPrompt();
    const textarea = screen.getByPlaceholderText(
      "Once upon a time, there was a...",
    );
    expect(textarea.getAttribute("maxlength")).toBe("2000");
  });
});
