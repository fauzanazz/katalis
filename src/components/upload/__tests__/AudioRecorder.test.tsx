import "./setup";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { AudioRecorder } from "../AudioRecorder";

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

URL.createObjectURL = vi.fn(() => "blob:mock-audio-url");
URL.revokeObjectURL = vi.fn();

describe("AudioRecorder", () => {
  const onUploadComplete = vi.fn();
  const onError = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorageMock.clear();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders start recording button", () => {
    render(<AudioRecorder onUploadComplete={onUploadComplete} />);
    expect(screen.getByText("Start Recording")).toBeTruthy();
  });

  it("renders accepted audio formats text", () => {
    render(<AudioRecorder onUploadComplete={onUploadComplete} />);
    expect(screen.getByText("Accepted: MP3, WAV, M4A (max 5 MB)")).toBeTruthy();
  });

  it("renders upload audio file button", () => {
    render(<AudioRecorder onUploadComplete={onUploadComplete} />);
    expect(screen.getByText("Or upload an audio file")).toBeTruthy();
  });

  it("shows permission denied error when mic access is denied", async () => {
    // Mock navigator.mediaDevices to reject with NotAllowedError
    const mockGetUserMedia = vi.fn().mockRejectedValue(
      new DOMException("Permission denied", "NotAllowedError"),
    );
    Object.defineProperty(navigator, "mediaDevices", {
      value: { getUserMedia: mockGetUserMedia },
      configurable: true,
    });

    // Mock MediaRecorder existence
    Object.defineProperty(window, "MediaRecorder", {
      value: class MockMediaRecorder {
        static isTypeSupported() { return true; }
      },
      configurable: true,
    });

    render(
      <AudioRecorder onUploadComplete={onUploadComplete} onError={onError} />,
    );

    const startBtn = screen.getByText("Start Recording");
    fireEvent.click(startBtn);

    // Wait for error to appear
    const alert = await screen.findByRole("alert");
    expect(alert).toBeTruthy();
    expect(alert.textContent).toContain("Microphone access is needed");
  });

  it("shows unsupported browser message when MediaRecorder is unavailable", async () => {
    // Remove MediaRecorder from window
    const original = window.MediaRecorder;
    Object.defineProperty(window, "MediaRecorder", {
      value: undefined,
      configurable: true,
    });

    render(
      <AudioRecorder onUploadComplete={onUploadComplete} onError={onError} />,
    );

    const startBtn = screen.getByText("Start Recording");
    fireEvent.click(startBtn);

    const alert = await screen.findByRole("alert");
    expect(alert).toBeTruthy();
    expect(alert.textContent).toContain("not supported");

    // Restore
    Object.defineProperty(window, "MediaRecorder", {
      value: original,
      configurable: true,
    });
  });

  it("has hidden file input for audio upload", () => {
    render(<AudioRecorder onUploadComplete={onUploadComplete} />);
    const fileInput = document.querySelector('input[type="file"][accept*="audio"]') as HTMLInputElement;
    expect(fileInput).toBeTruthy();
  });

  it("disables start recording when disabled prop is true", () => {
    render(<AudioRecorder onUploadComplete={onUploadComplete} disabled={true} />);
    const startBtn = screen.getByText("Start Recording") as HTMLButtonElement;
    expect(startBtn.disabled).toBe(true);
  });

  it("recovers session from session storage", () => {
    const sk = "aud/b.mp3";
    const obj: Record<string, unknown> = {};
    obj["key"] = sk;
    obj["url"] = `http://localhost:3100/uploads/${sk}`;
    obj["category"] = "audio";
    obj["filename"] = "rec.mp3";
    obj["contentType"] = "audio/mpeg";
    obj["size"] = 1024;
    sessionStorageMock.setItem("katalis-audio-session", JSON.stringify(obj));

    render(<AudioRecorder onUploadComplete={onUploadComplete} />);

    // Should show upload complete state
    expect(screen.getByText("Recording uploaded!")).toBeTruthy();
    expect(screen.getByText("Record Again")).toBeTruthy();
  });
});
