import "@/components/upload/__tests__/setup";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import DiscoverPage from "../page";

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
    global.fetch = vi.fn();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders the discovery page with title", () => {
    render(<DiscoverPage />);
    expect(screen.getByText("Discover Your Talents")).toBeTruthy();
  });

  it("renders flow selection with image and audio options", () => {
    render(<DiscoverPage />);
    expect(screen.getByText("How would you like to share?")).toBeTruthy();
    expect(screen.getByText("Upload an Image")).toBeTruthy();
    expect(screen.getByText("Record Your Voice")).toBeTruthy();
  });

  it("shows image upload zone when image option is selected", () => {
    render(<DiscoverPage />);
    const imageBtn = screen.getByText("Upload an Image");
    fireEvent.click(imageBtn);
    expect(screen.getByText("Drag and drop your image here")).toBeTruthy();
    expect(screen.getByText("Back to choices")).toBeTruthy();
  });

  it("shows audio recorder when audio option is selected", () => {
    render(<DiscoverPage />);
    const audioBtn = screen.getByText("Record Your Voice");
    fireEvent.click(audioBtn);
    expect(screen.getByText("Start Recording")).toBeTruthy();
    expect(screen.getByText("Back to choices")).toBeTruthy();
  });

  it("can navigate back to flow selection", () => {
    render(<DiscoverPage />);

    // Go to image flow
    fireEvent.click(screen.getByText("Upload an Image"));
    expect(screen.getByText("Drag and drop your image here")).toBeTruthy();

    // Go back
    fireEvent.click(screen.getByText("Back to choices"));
    expect(screen.getByText("How would you like to share?")).toBeTruthy();
  });

  it("flow selection buttons are keyboard accessible", () => {
    render(<DiscoverPage />);
    const imageBtn = screen.getByText("Upload an Image").closest("button");
    const audioBtn = screen.getByText("Record Your Voice").closest("button");
    expect(imageBtn).toBeTruthy();
    expect(audioBtn).toBeTruthy();
  });
});
