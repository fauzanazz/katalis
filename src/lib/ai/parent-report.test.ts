import { afterEach, describe, expect, it, vi } from "vitest";

const { createMock } = vi.hoisted(() => ({
  createMock: vi.fn(async (args: Record<string, unknown>) => ({
    choices: [
      {
        message: {
          content: JSON.stringify({
            strengths: ["Curious builder"],
            growthAreas: ["Keep trying when a step is tricky"],
            tips: [
              {
                title: "Retell the mission",
                description: "Ask your child what happened first.",
                materials: ["paper"],
                category: "storytelling",
              },
            ],
            summary: "Your child kept exploring this week.",
            badgeHighlights: ["story-spark"],
          }),
        },
      },
    ],
    _args: args,
  })),
}));

vi.mock("openai", () => ({
  default: class OpenAI {
    chat = {
      completions: {
        create: createMock,
      },
    };
  },
}));

import { generateAIReport, parseParentReportResponse } from "./parent-report";

afterEach(() => {
  vi.unstubAllEnvs();
  createMock.mockClear();
});

describe("parseParentReportResponse", () => {
  it("parses fenced JSON with literal newlines inside string values", () => {
    const raw = [
      "```json",
      "{",
      '  "strengths": ["Curious builder"],',
      '  "growthAreas": ["Keep trying when a step is tricky"],',
      '  "tips": [',
      "    {",
      '      "title": "Retell the mission",',
      '      "description": "Ask your child what happened first.',
      'Then ask what they want to try next time.",',
      '      "materials": ["paper"],',
      '      "category": "storytelling"',
      "    }",
      "  ],",
      '  "summary": "Your child kept exploring this week.',
      'They stayed engaged when the activity changed.",',
      '  "badgeHighlights": ["story-spark"]',
      "}",
      "```",
    ].join("\n");

    const parsed = parseParentReportResponse(raw);

    expect(parsed.summary).toContain("\n");
    expect(parsed.tips[0]?.description).toContain("\n");
    expect(parsed.badgeHighlights).toEqual(["story-spark"]);
  });

  it("extracts the first JSON object and removes trailing commas", () => {
    const parsed = parseParentReportResponse(`Here is the report:\n{\n  "strengths": ["Focused finisher",],\n  "growthAreas": ["Invite more reflection"],\n  "tips": [\n    {\n      "title": "Kitchen sorting",\n      "description": "Sort spoons by size.",\n      "materials": ["spoons", "cups",],\n      "category": "hands-on"\n    },\n  ],\n  "summary": "A steady week of hands-on play.",\n  "badgeHighlights": ["maker-week",],\n}\nThanks!`);

    expect(parsed.strengths).toEqual(["Focused finisher"]);
    expect(parsed.tips[0]?.materials).toEqual(["spoons", "cups"]);
    expect(parsed.badgeHighlights).toEqual(["maker-week"]);
  });
});

describe("generateAIReport", () => {
  it("disables reasoning for Google JSON requests", async () => {
    vi.stubEnv("AI_PROVIDER", "google");
    vi.stubEnv("GOOGLE_AI_API_KEY", "test-key");
    vi.stubEnv("GOOGLE_AI_MODEL", "gemini-2.5-flash");

    await generateAIReport({
      childTalents: ["storytelling"],
      completedQuests: 3,
      completedMissions: 5,
      badgesEarned: ["story-spark"],
      reflectionsCount: 2,
      mentorInteractions: 4,
      periodStart: "2026-07-01T00:00:00.000Z",
      periodEnd: "2026-07-08T00:00:00.000Z",
    });

    expect(createMock).toHaveBeenCalledTimes(1);
    expect(createMock.mock.calls[0]?.[0]).toMatchObject({
      response_format: { type: "json_object" },
      max_tokens: 2500,
      temperature: 0.3,
      reasoning_effort: "none",
    });
  });
});
