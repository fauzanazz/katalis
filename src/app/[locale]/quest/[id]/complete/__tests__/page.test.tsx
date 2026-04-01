import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
} from "vitest";
import "@testing-library/jest-dom/vitest";
import {
  render,
  screen,
  waitFor,
  fireEvent,
  cleanup,
} from "@testing-library/react";
import "./setup";
import QuestCompletePage from "../page";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

function createCompletedQuestData() {
  return {
    id: "test-quest-id",
    dream: "I want to build robots that help people",
    localContext: "I live in a village near a river",
    status: "completed" as string,
    generatedAt: "2024-01-15T10:00:00Z",
    createdAt: "2024-01-15T10:00:00Z",
    missions: Array.from({ length: 7 }, (_, i) => ({
      id: `m${i + 1}`,
      day: i + 1,
      title: `Day ${i + 1} Mission`,
      description: `Description for day ${i + 1}`,
      instructions: [`Step 1 for day ${i + 1}`],
      materials: [`Material for day ${i + 1}`],
      tips: [`Tip for day ${i + 1}`],
      status: "completed" as string,
      proofPhotoUrl: `http://localhost:3100/api/storage/proof-${i + 1}.jpg` as string | null,
    })),
    completedCount: 7,
    totalMissions: 7,
    detectedTalents: [
      {
        name: "Engineering",
        confidence: 0.92,
        reasoning: "Focus on mechanical details",
      },
    ],
  };
}

describe("QuestCompletePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders loading state initially", () => {
    mockFetch.mockImplementation(() => new Promise(() => {}));
    render(<QuestCompletePage />);
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("renders celebration screen when quest is completed", async () => {
    const questData = createCompletedQuestData();
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(questData),
    });

    render(<QuestCompletePage />);

    await waitFor(() => {
      expect(
        screen.getByText("Quest Complete!"),
      ).toBeInTheDocument();
    });

    expect(
      screen.getByText("Congratulations! You did it!"),
    ).toBeInTheDocument();
  });

  it("shows summary of 7-day journey", async () => {
    const questData = createCompletedQuestData();
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(questData),
    });

    render(<QuestCompletePage />);

    await waitFor(() => {
      expect(
        screen.getByText("Your 7-Day Journey"),
      ).toBeInTheDocument();
    });

    expect(
      screen.getByText("7 missions completed"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("7 photos uploaded"),
    ).toBeInTheDocument();
  });

  it("shows the dream label with quest dream", async () => {
    const questData = createCompletedQuestData();
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(questData),
    });

    render(<QuestCompletePage />);

    await waitFor(() => {
      expect(
        screen.getByText("I want to build robots that help people"),
      ).toBeInTheDocument();
    });
  });

  it("renders best work selection with 7 proof photos", async () => {
    const questData = createCompletedQuestData();
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(questData),
    });

    render(<QuestCompletePage />);

    await waitFor(() => {
      expect(
        screen.getByText("Select Your Best Work"),
      ).toBeInTheDocument();
    });

    // Check all 7 photos are shown
    const photoButtons = screen.getAllByRole("radio");
    expect(photoButtons.length).toBe(7);
  });

  it("allows selecting a best work photo", async () => {
    const questData = createCompletedQuestData();
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(questData),
    });

    render(<QuestCompletePage />);

    await waitFor(() => {
      expect(
        screen.getByText("Select Your Best Work"),
      ).toBeInTheDocument();
    });

    // Click on first photo
    const photoButtons = screen.getAllByRole("radio");
    fireEvent.click(photoButtons[2]); // Select Day 3

    // Should show selected label
    expect(
      screen.getByText("Selected: Day 3"),
    ).toBeInTheDocument();
  });

  it("shows gallery preview after selecting best work", async () => {
    const questData = createCompletedQuestData();
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(questData),
    });

    render(<QuestCompletePage />);

    await waitFor(() => {
      expect(
        screen.getByText("Select Your Best Work"),
      ).toBeInTheDocument();
    });

    // Select a photo
    const photoButtons = screen.getAllByRole("radio");
    fireEvent.click(photoButtons[0]);

    // Gallery preview should show
    expect(
      screen.getByText("Gallery Preview"),
    ).toBeInTheDocument();
  });

  it("shows submit to gallery and skip buttons", async () => {
    const questData = createCompletedQuestData();
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(questData),
    });

    render(<QuestCompletePage />);

    await waitFor(() => {
      expect(
        screen.getByText("Select Your Best Work"),
      ).toBeInTheDocument();
    });

    // Select a photo to enable submit
    const photoButtons = screen.getAllByRole("radio");
    fireEvent.click(photoButtons[0]);

    expect(
      screen.getByText("Submit to Gallery"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Skip for Now"),
    ).toBeInTheDocument();
  });

  it("submits to gallery and shows success", async () => {
    const questData = createCompletedQuestData();
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(questData),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            galleryEntry: {
              id: "gallery-1",
              imageUrl: "http://localhost:3100/api/storage/proof-1.jpg",
              talentCategory: "Engineering",
              country: "village near a river",
            },
          }),
      });

    render(<QuestCompletePage />);

    await waitFor(() => {
      expect(
        screen.getByText("Select Your Best Work"),
      ).toBeInTheDocument();
    });

    // Select a photo
    const photoButtons = screen.getAllByRole("radio");
    fireEvent.click(photoButtons[0]);

    // Click submit
    const submitBtn = screen.getByText("Submit to Gallery");
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(
        screen.getByText("Your work has been added to the gallery!"),
      ).toBeInTheDocument();
    });

    // View gallery link should appear
    expect(screen.getByText("View Gallery")).toBeInTheDocument();
  });

  it("handles skip gallery option", async () => {
    const questData = createCompletedQuestData();
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(questData),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            galleryEntry: null,
            skipped: true,
          }),
      });

    render(<QuestCompletePage />);

    await waitFor(() => {
      expect(
        screen.getByText("Select Your Best Work"),
      ).toBeInTheDocument();
    });

    // Click skip
    const skipBtn = screen.getByText("Skip for Now");
    fireEvent.click(skipBtn);

    // Should redirect or show appropriate state (quest is still done)
    await waitFor(() => {
      // After skipping, the quest page link should appear
      expect(
        screen.getByText("Back to Quests"),
      ).toBeInTheDocument();
    });
  });

  it("renders not ready state for incomplete quests", async () => {
    const questData = createCompletedQuestData();
    questData.status = "active";
    questData.completedCount = 5;
    questData.missions[5].status = "available";
    questData.missions[5].proofPhotoUrl = null;
    questData.missions[6].status = "locked";
    questData.missions[6].proofPhotoUrl = null;

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(questData),
    });

    render(<QuestCompletePage />);

    await waitFor(() => {
      expect(
        screen.getByText("Quest Not Ready"),
      ).toBeInTheDocument();
    });
  });

  it("has accessible screen reader announcement", async () => {
    const questData = createCompletedQuestData();
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(questData),
    });

    render(<QuestCompletePage />);

    await waitFor(() => {
      expect(
        screen.getByText("Quest Complete!"),
      ).toBeInTheDocument();
    });

    // Check for sr-only announcement
    const announcement = screen.getByRole("status");
    expect(announcement).toBeInTheDocument();
    expect(announcement).toHaveTextContent(
      "Congratulations! You have completed your quest!",
    );
  });

  it("shows error state when fetch fails", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
    });

    render(<QuestCompletePage />);

    await waitFor(() => {
      expect(
        screen.getByText("Quest not found"),
      ).toBeInTheDocument();
    });
  });
});
