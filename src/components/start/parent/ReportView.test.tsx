import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/paraglide/messages", () => ({
  m: {
    parent_report_weeklyReport: () => "Weekly report",
    parent_report_biweeklyReport: () => "Biweekly report",
    parent_report_period: ({ start, end }: { start: string; end: string }) => `${start} - ${end}`,
    parent_report_downloadPdf: () => "Download PDF",
    parent_report_summaryLabel: () => "Summary",
    parent_report_strengthsLabel: () => "Strengths",
    parent_report_growthLabel: () => "Growth",
    parent_report_tipsLabel: () => "Tips",
    parent_report_badgesLabel: () => "Badges",
    parent_report_generatedAt: ({ date }: { date: string }) => `Generated ${date}`,
  },
}));

vi.mock("@/paraglide/runtime", () => ({
  getLocale: () => "en-US",
}));

vi.mock("@/components/start/auth/use-step-up", () => ({
  useStepUp: () => ({
    withStepUp: async <T,>(fn: () => Promise<T>) => fn(),
    stepUpDialog: null,
  }),
}));

vi.mock("@/lib/server/parent-reports", () => ({
  downloadReportPdfFn: vi.fn(),
}));

import { ReportView } from "./ReportView";
afterEach(() => {
  cleanup();
});


describe("ReportView", () => {
  it("skips legacy engagement payloads instead of crashing", () => {
    const report = JSON.parse(`{
      "id": "report-1",
      "childId": "child-1",
      "type": "weekly",
      "period": {
        "start": "2026-07-01T00:00:00.000Z",
        "end": "2026-07-08T00:00:00.000Z"
      },
      "strengths": ["Curious builder"],
      "growthAreas": ["Keep trying when tasks feel tricky"],
      "tips": [
        {
          "title": "Retell the mission",
          "description": "Ask what happened first and what to try next.",
          "materials": ["paper"],
          "category": "storytelling"
        }
      ],
      "summary": "A warm summary.",
      "badgeHighlights": ["story-spark"],
      "createdAt": "2026-07-08T00:00:00.000Z",
      "engagement": {
        "completedMissions": 3,
        "completedQuests": 1,
        "frustrationEvents": 0,
        "adjustmentEvents": 0,
        "reflectionsCount": 0,
        "mentorInteractions": 2
      }
    }`);

    render(<ReportView report={report} />);

    expect(screen.getByText("Summary")).not.toBeNull();
    expect(screen.queryByText("Mission Progress")).toBeNull();
  });
  it("treats missing legacy arrays as empty sections", () => {
    const report = JSON.parse(`{
      "id": "report-2",
      "childId": "child-1",
      "type": "weekly",
      "period": {
        "start": "2026-07-01T00:00:00.000Z",
        "end": "2026-07-08T00:00:00.000Z"
      },
      "summary": "Another warm summary.",
      "createdAt": "2026-07-08T00:00:00.000Z",
      "strengths": null,
      "growthAreas": null,
      "tips": null,
      "badgeHighlights": null
    }`);

    render(<ReportView report={report} />);

    expect(screen.getByText("Summary")).not.toBeNull();
    expect(screen.queryByText("Strengths")).toBeNull();
    expect(screen.queryByText("Tips")).toBeNull();
  });

});
