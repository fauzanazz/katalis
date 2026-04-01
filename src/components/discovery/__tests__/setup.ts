import { vi } from "vitest";

// Mock next-intl with analysis translations
vi.mock("next-intl", () => {
  const translations: Record<string, string> = {
    // discover.analysis.*
    "discover.analysis.analyzeButton": "Discover My Talents",
    "discover.analysis.loading": "Analyzing your creation...",
    "discover.analysis.loadingSubtext": "Our AI is looking for your unique talents and interests!",
    "discover.analysis.resultsTitle": "Your Talents Discovered!",
    "discover.analysis.resultsSubtitle": "Here's what makes you special:",
    "discover.analysis.talentCardLabel": "Talent: {name}",
    "discover.analysis.confidenceLabel": "{name} confidence: {percent}%",
    "discover.analysis.discoverAgain": "Discover More Talents",
    "discover.analysis.errorGeneral": "Oops! We couldn't analyze your creation right now.",
    "discover.analysis.errorTimeout": "The analysis is taking a bit too long. Let's try again!",
    "discover.analysis.errorNetwork": "It seems you're not connected.",
    "discover.analysis.errorHint": "Don't worry, your upload is safe. Just tap the button to try again!",
    "discover.analysis.retry": "Try Again",
    // discover flow selection
    "discover.title": "Discover Your Talents",
    "discover.subtitle": "Upload a drawing, photo, or record your voice to discover your unique talents!",
    "discover.flowSelection.title": "How would you like to share?",
    "discover.flowSelection.uploadArtifact": "Upload an Image",
    "discover.flowSelection.uploadArtifactDesc": "Share a drawing, painting, photo, or any creative work",
    "discover.flowSelection.recordAudio": "Record Your Voice",
    "discover.flowSelection.recordAudioDesc": "Tell us about your interests, sing, or share a story",
    "discover.flowSelection.storyMode": "Story Mode",
    "discover.flowSelection.storyModeDesc": "See pictures and create an amazing story about them",
    "discover.flowSelection.back": "Back to choices",
    // discover.story.*
    "discover.story.imagePromptTitle": "Look at these pictures!",
    "discover.story.imagePromptSubtitle": "Create a story inspired by what you see",
    "discover.story.imageGroupLabel": "Story prompt images",
    "discover.story.writeStory": "Write a Story",
    "discover.story.recordStory": "Record a Story",
    "discover.story.textLabel": "Your Story",
    "discover.story.textPlaceholder": "Once upon a time, there was a...",
    "discover.story.charCount": "{count}/{max} characters (minimum {min})",
    "discover.story.submitStory": "Discover My Talents",
    "discover.story.audioInstructions": "Record yourself telling a story about what you see in the pictures above!",
    "discover.story.validation.tooShort": "Your story needs at least {min} characters. Keep going, you're doing great!",
    "discover.story.validation.tooLong": "Your story is too long! Maximum {max} characters.",
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
