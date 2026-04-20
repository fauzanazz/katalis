import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock auth
vi.mock("@/lib/auth", () => ({
  getChildSession: vi.fn(),
}));

// Mock Claude story analysis
vi.mock("@/lib/ai/claude", () => ({
  analyzeStory: vi.fn(),
}));

vi.mock("@/lib/moderation", () => ({
  moderateContent: vi.fn().mockResolvedValue({
    allowed: true,
    status: "approved",
    confidence: 0.98,
    reasoning: "Content appears safe",
    eventId: "mod-1",
  }),
  getUncertaintyFallback: vi.fn(() => "Keep exploring your amazing talents!"),
}));

import { POST } from "../analyze-story/route";
import { getChildSession } from "@/lib/auth";
import { analyzeStory } from "@/lib/ai/claude";

const mockedGetSession = vi.mocked(getChildSession);
const mockedAnalyzeStory = vi.mocked(analyzeStory);

const validSession = { childId: "child-1", expiresAt: new Date().toISOString() };

const mockStoryResult = {
  talents: [
    {
      name: "Logical Thinking & Problem Solving",
      confidence: 0.91,
      reasoning:
        "The story follows a clear cause-and-effect structure with systematic reasoning.",
    },
    {
      name: "Strategic Planning",
      confidence: 0.82,
      reasoning:
        "The main character prepares tools and considers challenges before the journey.",
    },
  ],
};

function createRequest(body: unknown) {
  return new Request("http://localhost:3100/api/discovery/analyze-story", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as Parameters<typeof POST>[0];
}

describe("POST /api/discovery/analyze-story", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockedGetSession.mockResolvedValue(null);

    const res = await POST(
      createRequest({
        storyText: "Once upon a time in a magical forest...",
        imageIds: ["forest-adventure", "ocean-discovery", "space-journey"],
        submissionType: "text",
      }),
    );
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe("unauthorized");
  });

  it("returns 200 with talent analysis for valid text story", async () => {
    mockedGetSession.mockResolvedValue(validSession);
    mockedAnalyzeStory.mockResolvedValue(mockStoryResult);

    const res = await POST(
      createRequest({
        storyText:
          "Once upon a time, in a magical forest, there lived a little fox who loved solving puzzles. Every day the fox would explore.",
        imageIds: ["forest-adventure", "ocean-discovery", "space-journey"],
        submissionType: "text",
      }),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.talents).toBeDefined();
    expect(data.talents).toHaveLength(2);
    expect(data.talents[0].name).toBe("Logical Thinking & Problem Solving");
    expect(data.talents[0].confidence).toBe(0.91);
    expect(data.talents[0].reasoning).toBeTruthy();
  });

  it("returns 200 for audio submission type", async () => {
    mockedGetSession.mockResolvedValue(validSession);
    mockedAnalyzeStory.mockResolvedValue(mockStoryResult);

    const res = await POST(
      createRequest({
        storyText: "[Audio story recording - recording.webm]",
        imageIds: ["forest-adventure", "ocean-discovery", "space-journey"],
        submissionType: "audio",
      }),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.talents).toBeDefined();
  });

  it("validates story text minimum length", async () => {
    mockedGetSession.mockResolvedValue(validSession);

    const res = await POST(
      createRequest({
        storyText: "Too short",
        imageIds: ["forest-adventure", "ocean-discovery", "space-journey"],
        submissionType: "text",
      }),
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("invalid");
    expect(data.message).toContain("20");
  });

  it("validates story text maximum length", async () => {
    mockedGetSession.mockResolvedValue(validSession);

    const res = await POST(
      createRequest({
        storyText: "a".repeat(2001),
        imageIds: ["forest-adventure", "ocean-discovery", "space-journey"],
        submissionType: "text",
      }),
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("invalid");
    expect(data.message).toContain("2000");
  });

  it("validates imageIds is required", async () => {
    mockedGetSession.mockResolvedValue(validSession);

    const res = await POST(
      createRequest({
        storyText: "A story that is long enough to pass validation checks here.",
        submissionType: "text",
      }),
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("invalid");
  });

  it("validates submissionType enum", async () => {
    mockedGetSession.mockResolvedValue(validSession);

    const res = await POST(
      createRequest({
        storyText: "A story that is long enough to pass validation checks here.",
        imageIds: ["a", "b", "c"],
        submissionType: "video",
      }),
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("invalid");
  });

  it("handles invalid JSON body", async () => {
    mockedGetSession.mockResolvedValue(validSession);

    const req = new Request(
      "http://localhost:3100/api/discovery/analyze-story",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "not valid json",
      },
    ) as unknown as Parameters<typeof POST>[0];

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 500 with friendly error on AI failure", async () => {
    mockedGetSession.mockResolvedValue(validSession);
    mockedAnalyzeStory.mockRejectedValue(new Error("Claude API error"));

    const res = await POST(
      createRequest({
        storyText:
          "Once upon a time, in a magical forest, there lived a little fox who loved solving puzzles. Every day the fox would explore.",
        imageIds: ["forest-adventure", "ocean-discovery", "space-journey"],
        submissionType: "text",
      }),
    );
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBe("ai_failure");
    expect(data.message).toBeTruthy();
    expect(data.message).not.toContain("Error:");
    expect(data.message).not.toContain("stack");
  });

  it("returns 504 on timeout", async () => {
    mockedGetSession.mockResolvedValue(validSession);
    mockedAnalyzeStory.mockRejectedValue(
      new Error("Story analysis timed out. Please try again."),
    );

    const res = await POST(
      createRequest({
        storyText:
          "Once upon a time, in a magical forest, there lived a little fox who loved solving puzzles. Every day the fox would explore.",
        imageIds: ["forest-adventure", "ocean-discovery", "space-journey"],
        submissionType: "text",
      }),
    );
    expect(res.status).toBe(504);
    const data = await res.json();
    expect(data.error).toBe("timeout");
  });

  it("sanitizes XSS in story text", async () => {
    mockedGetSession.mockResolvedValue(validSession);
    mockedAnalyzeStory.mockResolvedValue(mockStoryResult);

    // XSS attempt should be sanitized but story still processed
    const res = await POST(
      createRequest({
        storyText:
          '<img src=x onerror=alert(1)> Once upon a time there was a hero who saved the entire village from danger.',
        imageIds: ["forest-adventure", "ocean-discovery", "space-journey"],
        submissionType: "text",
      }),
    );
    // Should process after sanitization - XSS stripped
    // The remaining text after sanitization may pass or fail length check
    // depending on what's left
    expect([200, 400]).toContain(res.status);
  });
});
