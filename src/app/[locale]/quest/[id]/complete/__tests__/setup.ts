import { vi } from "vitest";

// Mock next-intl
vi.mock("next-intl", () => {
  const translations: Record<string, string> = {
    // Quest completion page
    "quest.complete.title": "Quest Complete!",
    "quest.complete.congratulations": "Congratulations! You did it!",
    "quest.complete.summary": "Your 7-Day Journey",
    "quest.complete.missionsCompleted": "{count} missions completed",
    "quest.complete.photosUploaded": "{count} photos uploaded",
    "quest.complete.dreamLabel": "Your Dream",
    "quest.complete.selectBestWork": "Select Your Best Work",
    "quest.complete.selectBestWorkDesc":
      "Choose your favorite proof photo to showcase in the gallery!",
    "quest.complete.selectedPhoto": "Selected: Day {day}",
    "quest.complete.previewTitle": "Gallery Preview",
    "quest.complete.previewDesc":
      "This is how your work will appear in the gallery.",
    "quest.complete.talentLabel": "Talent",
    "quest.complete.locationLabel": "Location",
    "quest.complete.submitToGallery": "Submit to Gallery",
    "quest.complete.skipGallery": "Skip for Now",
    "quest.complete.submitting": "Submitting...",
    "quest.complete.submitSuccess":
      "Your work has been added to the gallery!",
    "quest.complete.submitError":
      "Could not submit to gallery. Please try again.",
    "quest.complete.viewGallery": "View Gallery",
    "quest.complete.backToQuest": "Back to Quest",
    "quest.complete.loading": "Loading...",
    "quest.complete.notReady": "Quest Not Ready",
    "quest.complete.notReadyDesc":
      "Complete all 7 missions first to see the celebration!",
    "quest.complete.dayPhoto": "Day {day}: {title}",
    "quest.complete.photoAlt": "Proof photo for Day {day}: {title}",
    "quest.complete.journeySummary":
      "You completed a 7-day quest to pursue your dream!",
    "quest.complete.encouragement":
      "You showed amazing dedication and creativity. Keep dreaming big!",
    "quest.complete.galleryEntryPreview": "Gallery entry preview",
    "quest.complete.celebrationAnnouncement":
      "Congratulations! You have completed your quest!",
    "quest.overview.backToQuests": "Back to Quests",
    "quest.overview.loading": "Loading your quest...",
    "quest.overview.notFound": "Quest not found",
    "quest.overview.notFoundDesc":
      "We couldn't find this quest. It may have been removed.",
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
    usePathname: () => "/en/quest/test-quest-id/complete",
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
  usePathname: () => "/en/quest/test-quest-id/complete",
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
  }),
}));
