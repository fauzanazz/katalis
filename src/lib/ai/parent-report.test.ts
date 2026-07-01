import { describe, expect, it } from "vitest";

import { parseParentReportResponse } from "./parent-report";

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
    const parsed = parseParentReportResponse(`Here is the report:
{
  "strengths": ["Focused finisher",],
  "growthAreas": ["Invite more reflection"],
  "tips": [
    {
      "title": "Kitchen sorting",
      "description": "Sort spoons by size.",
      "materials": ["spoons", "cups",],
      "category": "hands-on"
    },
  ],
  "summary": "A steady week of hands-on play.",
  "badgeHighlights": ["maker-week",],
}
Thanks!`);

    expect(parsed.strengths).toEqual(["Focused finisher"]);
    expect(parsed.tips[0]?.materials).toEqual(["spoons", "cups"]);
    expect(parsed.badgeHighlights).toEqual(["maker-week"]);
  });
});
