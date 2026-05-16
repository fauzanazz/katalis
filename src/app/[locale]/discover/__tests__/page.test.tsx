import "@/components/upload/__tests__/setup";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import DiscoverPage from "../page";

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
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();
Object.defineProperty(window, "sessionStorage", { value: sessionStorageMock });

URL.createObjectURL = vi.fn(() => "blob:mock-url");
URL.revokeObjectURL = vi.fn();

describe("DiscoverPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorageMock.clear();
    global.fetch = vi.fn().mockResolvedValue({
      json: vi.fn().mockResolvedValue({ authenticated: true, type: "child" }),
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("renders the discovery page with title", async () => {
    render(<DiscoverPage />);
    expect(await screen.findByText("Discover Your Talents")).toBeTruthy();
  });

  it("renders flow selection with image, audio, and story options", async () => {
    render(<DiscoverPage />);
    expect(await screen.findByText("How would you like to share?")).toBeTruthy();
    expect(screen.getByText("Upload an Image")).toBeTruthy();
    expect(screen.getByText("Record Your Voice")).toBeTruthy();
    expect(screen.getByText("Story Mode")).toBeTruthy();
  });

  it("shows image upload zone when image option is selected", async () => {
    render(<DiscoverPage />);
    const imageBtn = await screen.findByText("Upload an Image");
    fireEvent.click(imageBtn);
    expect(screen.getByText("Drag and drop your image here")).toBeTruthy();
    expect(screen.getByText("Back to choices")).toBeTruthy();
  });

  it("shows audio recorder when audio option is selected", async () => {
    render(<DiscoverPage />);
    const audioBtn = await screen.findByText("Record Your Voice");
    fireEvent.click(audioBtn);
    expect(screen.getByText("Start Recording")).toBeTruthy();
    expect(screen.getByText("Back to choices")).toBeTruthy();
  });

  it("shows story prompt when story mode is selected", async () => {
    render(<DiscoverPage />);
    const storyBtn = await screen.findByText("Story Mode");
    fireEvent.click(storyBtn);
    expect(screen.getByText("Look at these pictures!")).toBeTruthy();
    expect(screen.getByText("Back to choices")).toBeTruthy();
  });

  it("can navigate back to flow selection from story mode", async () => {
    render(<DiscoverPage />);

    // Go to story flow
    fireEvent.click(await screen.findByText("Story Mode"));
    expect(screen.getByText("Look at these pictures!")).toBeTruthy();

    // Go back
    fireEvent.click(screen.getByText("Back to choices"));
    expect(await screen.findByText("How would you like to share?")).toBeTruthy();
  });

  it("can navigate back to flow selection", async () => {
    render(<DiscoverPage />);

    // Go to image flow
    fireEvent.click(await screen.findByText("Upload an Image"));
    expect(screen.getByText("Drag and drop your image here")).toBeTruthy();

    // Go back
    fireEvent.click(screen.getByText("Back to choices"));
    expect(await screen.findByText("How would you like to share?")).toBeTruthy();
  });

  it("flow selection buttons are keyboard accessible", async () => {
    render(<DiscoverPage />);
    const imageBtn = (await screen.findByText("Upload an Image")).closest("button");
    const audioBtn = screen.getByText("Record Your Voice").closest("button");
    const storyBtn = screen.getByText("Story Mode").closest("button");
    expect(imageBtn).toBeTruthy();
    expect(audioBtn).toBeTruthy();
    expect(storyBtn).toBeTruthy();
  });
});
