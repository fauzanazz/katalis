import { vi } from "vitest";

// Mock next-intl
vi.mock("next-intl", () => {
  const translations: Record<string, string> = {
    // Quest list page
    "quest.list.title": "Your Quests",
    "quest.list.subtitle": "Track your 7-day adventure quests!",
    "quest.list.empty": "No quests yet!",
    "quest.list.emptyDesc":
      "Complete a talent discovery first, then create your first 7-day quest adventure!",
    "quest.list.startFirst": "Discover Your Talents",
    "quest.list.activeQuest": "Active Quest",
    "quest.list.completedQuest": "Completed Quest",
    "quest.list.abandonedQuest": "Abandoned Quest",
    "quest.list.progress": "{completed} of {total} days completed",
    "quest.list.viewQuest": "View Quest",
    "quest.list.startNewQuest": "Start New Quest",
    "quest.list.createQuest": "Create a Quest",

    // Quest overview page
    "quest.overview.title": "Your Quest",
    "quest.overview.subtitle": "Your 7-day mission plan",
    "quest.overview.dreamLabel": "Your Dream",
    "quest.overview.progressLabel": "Quest Progress",
    "quest.overview.progressValue": "{completed} of {total} days completed",
    "quest.overview.progressPercent": "{percent}% Complete",
    "quest.overview.dayLabel": "Day {day}",
    "quest.overview.statusLocked": "Locked",
    "quest.overview.statusAvailable": "Available",
    "quest.overview.statusInProgress": "In Progress",
    "quest.overview.statusCompleted": "Completed",
    "quest.overview.lockedMessage":
      "Complete the previous day first to unlock this mission!",
    "quest.overview.clickToView": "Click to view mission details",
    "quest.overview.timeline": "Quest Timeline",
    "quest.overview.missionDetail": "Mission Details",
    "quest.overview.selectMission":
      "Select a day from the timeline to see mission details",
    "quest.overview.description": "Description",
    "quest.overview.instructions": "Instructions",
    "quest.overview.materials": "Materials Needed",
    "quest.overview.tips": "Helpful Tips",
    "quest.overview.stepNumber": "Step {number}",
    "quest.overview.backToQuests": "Back to Quests",
    "quest.overview.loading": "Loading your quest...",
    "quest.overview.notFound": "Quest not found",
    "quest.overview.notFoundDesc":
      "We couldn't find this quest. It may have been removed.",
    "quest.overview.questCompleted": "Quest Completed!",
    "quest.overview.questCompletedDesc":
      "Amazing job! You've completed all 7 days of your quest!",
    "quest.overview.readOnlyBanner":
      "This quest has been completed. You can review your missions below.",
    "quest.overview.noMaterials": "No special materials needed",
    "quest.overview.noTips": "No additional tips",
    "quest.overview.viewCompletion": "View Celebration",
  };

  return {
    useTranslations: (namespace?: string) => {
      return (key: string, params?: Record<string, unknown>) => {
        const fullKey = namespace ? `${namespace}.${key}` : key;
        let value = translations[fullKey] || fullKey;
        if (params) {
          Object.entries(params).forEach(([k, v]) => {
            value = value.replace(`{${k}}`, String(v));
          });
        }
        return value;
      };
    },
    useLocale: () => "en",
  };
});

// Mock @/i18n/navigation
vi.mock("@/i18n/navigation", async () => {
  const React = await import("react");
  return {
    Link: ({
      href,
      children,
      ...props
    }: Record<string, unknown>) => {
      return React.createElement(
        "a",
        { href: typeof href === "string" ? href : "/", ...props },
        children as React.ReactNode,
      );
    },
    usePathname: () => "/en/quest",
    useRouter: () => ({
      push: vi.fn(),
      replace: vi.fn(),
      refresh: vi.fn(),
    }),
  };
});

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "test-quest-id" }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/en/quest",
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
  }),
}));
