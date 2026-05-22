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

  it("renders persistent flow tabs (image, audio, story)", async () => {
    render(<DiscoverPage />);
    await screen.findByText("Discover Your Talents");
    expect(screen.getByText("Upload an Image")).toBeTruthy();
    expect(screen.getByText("Record Your Voice")).toBeTruthy();
    expect(screen.getByText("Story Mode")).toBeTruthy();
  });

  it("shows image upload zone when image tab is clicked", async () => {
    render(<DiscoverPage />);
    const imageBtn = await screen.findByText("Upload an Image");
    fireEvent.click(imageBtn);
    expect(await screen.findByText("Drag and drop your image here")).toBeTruthy();
  });

  it("shows audio recorder when audio tab is clicked", async () => {
    render(<DiscoverPage />);
    const audioBtn = await screen.findByText("Record Your Voice");
    fireEvent.click(audioBtn);
    expect(await screen.findByText("Start Recording")).toBeTruthy();
  });

  it("shows story prompt when story tab is clicked", async () => {
    render(<DiscoverPage />);
    const storyBtn = await screen.findByText("Story Mode");
    fireEvent.click(storyBtn);
    expect(await screen.findByText("Look at these pictures!")).toBeTruthy();
  });

  it("flow tab buttons are keyboard accessible", async () => {
    render(<DiscoverPage />);
    const imageBtn = (await screen.findByText("Upload an Image")).closest("button");
    const audioBtn = screen.getByText("Record Your Voice").closest("button");
    const storyBtn = screen.getByText("Story Mode").closest("button");
    expect(imageBtn).toBeTruthy();
    expect(audioBtn).toBeTruthy();
    expect(storyBtn).toBeTruthy();
  });
});
