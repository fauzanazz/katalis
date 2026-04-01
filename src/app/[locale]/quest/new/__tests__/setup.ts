import { vi } from "vitest";

// Mock next-intl
vi.mock("next-intl", () => {
  const translations: Record<string, string> = {
    "quest.new.title": "Create Your Quest",
    "quest.new.subtitle":
      "Tell us about your dream and where you live, and we'll create a personalized 7-day mission plan just for you!",
    "quest.new.talentSummary": "Your Detected Talents",
    "quest.new.noTalents":
      "Complete a discovery first to detect your talents!",
    "quest.new.dreamLabel": "What's Your Dream?",
    "quest.new.dreamPlaceholder":
      "I want to build robots that help people...",
    "quest.new.dreamHelp":
      "Tell us what you dream of doing or becoming. Be specific!",
    "quest.new.contextLabel": "Tell Us About Where You Live",
    "quest.new.contextPlaceholder":
      "I live in a village near a river. We have farms and a small market...",
    "quest.new.contextHelp":
      "This helps us suggest activities and materials available near you.",
    "quest.new.charCount": "{count}/{max}",
    "quest.new.charMin": "minimum {min} characters",
    "quest.new.generateButton": "Create My Quest!",
    "quest.new.generating": "Creating your quest...",
    "quest.new.generatingSubtext":
      "Our AI is designing 7 amazing days of adventure just for you!",
    "quest.new.validation.dreamEmpty": "Please tell us your dream!",
    "quest.new.validation.dreamTooShort":
      "Your dream needs at least {min} characters. Tell us more!",
    "quest.new.validation.dreamTooLong":
      "Your dream is too long! Maximum {max} characters.",
    "quest.new.validation.contextEmpty":
      "Please tell us about where you live!",
    "quest.new.validation.contextTooShort":
      "Your description needs at least {min} characters. Tell us more!",
    "quest.new.validation.contextTooLong":
      "Your description is too long! Maximum {max} characters.",
    "quest.new.error.general":
      "Oops! We couldn't create your quest right now.",
    "quest.new.error.timeout":
      "Quest creation is taking a bit too long. Let's try again!",
    "quest.new.error.network":
      "It seems you're not connected. Please check your internet and try again.",
    "quest.new.error.hint":
      "Don't worry, your dream and context are saved. Just tap the button to try again!",
    "quest.new.error.retry": "Try Again",
    "quest.new.success":
      "Quest created! Let's begin your adventure!",
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
    Link: ({ href, children, ...props }: Record<string, unknown>) => {
      return React.createElement(
        "a",
        { href: typeof href === "string" ? href : "/", ...props },
        children as React.ReactNode,
      );
    },
    usePathname: () => "/en/quest/new",
    useRouter: () => ({
      push: vi.fn(),
      replace: vi.fn(),
      refresh: vi.fn(),
    }),
  };
});
