import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock auth
vi.mock("@/lib/auth", () => ({
  getSession: vi.fn(),
}));

// Mock AI analysis
vi.mock("@/lib/ai/openai", () => ({
  analyzeArtifact: vi.fn(),
}));

import { POST } from "../analyze/route";
import { getSession } from "@/lib/auth";
import { analyzeArtifact } from "@/lib/ai/openai";

const mockedGetSession = vi.mocked(getSession);
const mockedAnalyze = vi.mocked(analyzeArtifact);

const validSession = { childId: "child-1", expiresAt: new Date().toISOString() };

const mockAnalysisResult = {
  talents: [
    {
      name: "Engineering & Mechanics",
      confidence: 0.92,
      reasoning: "The drawing shows remarkable attention to mechanical details.",
    },
    {
      name: "Spatial Reasoning",
      confidence: 0.78,
      reasoning: "The proportions are consistent and perspective maintained.",
    },
  ],
};

function createRequest(body: unknown) {
  return new Request("http://localhost:3100/api/discovery/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as Parameters<typeof POST>[0];
}

describe("POST /api/discovery/analyze", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockedGetSession.mockResolvedValue(null);

    const res = await POST(
      createRequest({ artifactUrl: "http://test.com/img.jpg", artifactType: "image" }),
    );
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe("unauthorized");
  });

  it("returns 200 with talent analysis for valid image", async () => {
    mockedGetSession.mockResolvedValue(validSession);
    mockedAnalyze.mockResolvedValue(mockAnalysisResult);

    const res = await POST(
      createRequest({
        artifactUrl: "http://localhost:3100/api/storage/images/test.jpg",
        artifactType: "image",
      }),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.talents).toBeDefined();
    expect(data.talents).toHaveLength(2);
    expect(data.talents[0].name).toBe("Engineering & Mechanics");
    expect(data.talents[0].confidence).toBe(0.92);
    expect(data.talents[0].reasoning).toBeTruthy();
  });

  it("returns 200 with talent analysis for audio", async () => {
    mockedGetSession.mockResolvedValue(validSession);
    const audioResult = {
      talents: [
        {
          name: "Storytelling & Narrative",
          confidence: 0.88,
          reasoning: "Natural storytelling ability with clear structure.",
        },
      ],
    };
    mockedAnalyze.mockResolvedValue(audioResult);

    const res = await POST(
      createRequest({
        artifactUrl: "http://localhost:3100/api/storage/audio/test.mp3",
        artifactType: "audio",
      }),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.talents[0].name).toBe("Storytelling & Narrative");
  });

  it("validates request body with Zod — missing artifactUrl", async () => {
    mockedGetSession.mockResolvedValue(validSession);

    const res = await POST(createRequest({ artifactType: "image" }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("invalid");
  });

  it("validates request body with Zod — invalid artifactType", async () => {
    mockedGetSession.mockResolvedValue(validSession);

    const res = await POST(
      createRequest({ artifactUrl: "http://test.com/img.jpg", artifactType: "video" }),
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("invalid");
  });

  it("validates request body with Zod — invalid JSON", async () => {
    mockedGetSession.mockResolvedValue(validSession);

    const req = new Request("http://localhost:3100/api/discovery/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not valid json",
    }) as unknown as Parameters<typeof POST>[0];

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("sanitizes input to prevent XSS", async () => {
    mockedGetSession.mockResolvedValue(validSession);

    const res = await POST(
      createRequest({
        artifactUrl: '<script>alert("xss")</script>',
        artifactType: "image",
      }),
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("invalid");
  });

  it("returns 500 with friendly error on AI failure", async () => {
    mockedGetSession.mockResolvedValue(validSession);
    mockedAnalyze.mockRejectedValue(new Error("OpenAI API error"));

    const res = await POST(
      createRequest({
        artifactUrl: "http://localhost:3100/api/storage/images/test.jpg",
        artifactType: "image",
      }),
    );
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBe("ai_failure");
    expect(data.message).toBeTruthy();
    // Should be friendly, not contain stack traces
    expect(data.message).not.toContain("Error:");
    expect(data.message).not.toContain("stack");
  });

  it("returns 504 on timeout", async () => {
    mockedGetSession.mockResolvedValue(validSession);
    mockedAnalyze.mockRejectedValue(new Error("Analysis timed out. Please try again."));

    const res = await POST(
      createRequest({
        artifactUrl: "http://localhost:3100/api/storage/images/test.jpg",
        artifactType: "image",
      }),
    );
    expect(res.status).toBe(504);
    const data = await res.json();
    expect(data.error).toBe("timeout");
  });

  it("handles XSS with onerror pattern", async () => {
    mockedGetSession.mockResolvedValue(validSession);

    const res = await POST(
      createRequest({
        artifactUrl: '<img src=x onerror=alert(1)>',
        artifactType: "image",
      }),
    );
    expect(res.status).toBe(400);
  });
});
