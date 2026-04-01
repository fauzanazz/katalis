import "./setup";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { UploadZone } from "../UploadZone";

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

// Mock URL.createObjectURL
URL.createObjectURL = vi.fn(() => "blob:mock-url");
URL.revokeObjectURL = vi.fn();

describe("UploadZone", () => {
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

  it("renders the dropzone with correct text", () => {
    render(<UploadZone onUploadComplete={onUploadComplete} />);
    // Desktop text
    expect(screen.getByText("Drag and drop your image here")).toBeTruthy();
    expect(screen.getByText("Accepted: JPEG, PNG, WebP (max 10 MB)")).toBeTruthy();
  });

  it("renders the dropzone with keyboard accessible role=button", () => {
    render(<UploadZone onUploadComplete={onUploadComplete} />);
    const dropzone = screen.getByRole("button", { name: /drag and drop/i });
    expect(dropzone).toBeTruthy();
    expect(dropzone.getAttribute("tabindex")).toBe("0");
  });

  it("renders mobile-friendly tap-to-upload text", () => {
    render(<UploadZone onUploadComplete={onUploadComplete} />);
    expect(screen.getByText("Tap to upload")).toBeTruthy();
  });

  it("renders camera capture button for mobile", () => {
    render(<UploadZone onUploadComplete={onUploadComplete} />);
    expect(screen.getByText("Take a Photo")).toBeTruthy();
  });

  it("shows drag-over feedback visual", () => {
    render(<UploadZone onUploadComplete={onUploadComplete} />);
    const dropzone = screen.getByRole("button", { name: /drag and drop/i });

    fireEvent.dragOver(dropzone, {
      dataTransfer: { files: [] },
    });
    // Check for active state text
    expect(screen.getByText("Drop your image here!")).toBeTruthy();
  });

  it("reverts drag-over state on drag leave", () => {
    render(<UploadZone onUploadComplete={onUploadComplete} />);
    const dropzone = screen.getByRole("button", { name: /drag and drop/i });

    fireEvent.dragOver(dropzone, { dataTransfer: { files: [] } });
    fireEvent.dragLeave(dropzone, { dataTransfer: { files: [] } });
    expect(screen.getByText("Drag and drop your image here")).toBeTruthy();
  });

  it("shows error for invalid file type on drop", () => {
    render(
      <UploadZone onUploadComplete={onUploadComplete} onError={onError} />,
    );
    const dropzone = screen.getByRole("button", { name: /drag and drop/i });

    const file = new File(["content"], "test.exe", {
      type: "application/x-msdownload",
    });

    fireEvent.drop(dropzone, {
      dataTransfer: { files: [file] },
    });

    expect(screen.getByRole("alert")).toBeTruthy();
    expect(
      screen.getByText(/Unsupported file type/i),
    ).toBeTruthy();
  });

  it("shows error for oversized file on drop", () => {
    render(
      <UploadZone onUploadComplete={onUploadComplete} onError={onError} />,
    );
    const dropzone = screen.getByRole("button", { name: /drag and drop/i });

    // Create a mock file that's >10MB
    const bigContent = new ArrayBuffer(11 * 1024 * 1024);
    const file = new File([bigContent], "big.jpg", {
      type: "image/jpeg",
    });
    // Override size since File in jsdom may not respect ArrayBuffer size
    Object.defineProperty(file, "size", { value: 11 * 1024 * 1024 });

    fireEvent.drop(dropzone, {
      dataTransfer: { files: [file] },
    });

    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.getByText(/File too large/i)).toBeTruthy();
  });

  it("shows error for multiple files on drop", () => {
    render(
      <UploadZone onUploadComplete={onUploadComplete} onError={onError} />,
    );
    const dropzone = screen.getByRole("button", { name: /drag and drop/i });

    const file1 = new File(["a"], "a.jpg", { type: "image/jpeg" });
    const file2 = new File(["b"], "b.jpg", { type: "image/jpeg" });

    fireEvent.drop(dropzone, {
      dataTransfer: { files: [file1, file2] },
    });

    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.getByText(/one file at a time/i)).toBeTruthy();
  });

  it("shows disabled state when disabled prop is true", () => {
    render(
      <UploadZone onUploadComplete={onUploadComplete} disabled={true} />,
    );
    const dropzone = screen.getByRole("button", { name: /drag and drop/i });
    expect(dropzone.getAttribute("aria-disabled")).toBe("true");
  });

  it("includes hidden file inputs with correct accept attribute", () => {
    render(<UploadZone onUploadComplete={onUploadComplete} />);
    const fileInputs = document.querySelectorAll('input[type="file"]');
    expect(fileInputs.length).toBeGreaterThanOrEqual(2);
    // First input accepts image types
    const imageInput = fileInputs[0] as HTMLInputElement;
    expect(imageInput.getAttribute("accept")).toContain("image/jpeg");
    expect(imageInput.getAttribute("accept")).toContain("image/png");
    expect(imageInput.getAttribute("accept")).toContain("image/webp");
  });

  it("has camera input with capture attribute", () => {
    render(<UploadZone onUploadComplete={onUploadComplete} />);
    const cameraInput = document.querySelector('input[capture]') as HTMLInputElement;
    expect(cameraInput).toBeTruthy();
    expect(cameraInput.getAttribute("capture")).toBe("environment");
  });

  it("shows alt text on preview images", async () => {
    // Mock a successful upload scenario by setting session storage
    const sk = "img/a.jpg";
    const obj: Record<string, unknown> = {};
    obj["key"] = sk;
    obj["url"] = `http://localhost:3100/uploads/${sk}`;
    obj["category"] = "image";
    obj["filename"] = "a.jpg";
    obj["contentType"] = "image/jpeg";
    obj["size"] = 1024;
    sessionStorageMock.setItem("katalis-upload-session", JSON.stringify(obj));

    render(<UploadZone onUploadComplete={onUploadComplete} />);

    // Session recovery should load the completed state
    const img = await screen.findByAltText("Preview of uploaded image");
    expect(img).toBeTruthy();
  });
});
