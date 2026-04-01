import { vi } from "vitest";

// Mock next-intl
vi.mock("next-intl", () => {
  const translations: Record<string, string> = {
    // discover.upload.*
    "discover.upload.dropzone": "Drag and drop your image here",
    "discover.upload.dropzoneActive": "Drop your image here!",
    "discover.upload.tapToUpload": "Tap to upload",
    "discover.upload.clickToUpload": "or click to select a file",
    "discover.upload.cameraCapture": "Take a Photo",
    "discover.upload.acceptedFormats": "Accepted: JPEG, PNG, WebP (max 10 MB)",
    "discover.upload.uploading": "Uploading your file...",
    "discover.upload.uploadComplete": "Upload complete!",
    "discover.upload.uploadFailed": "Upload failed. Please try again.",
    "discover.upload.networkError": "Upload failed. Please check your connection and try again.",
    "discover.upload.removeFile": "Remove file",
    "discover.upload.replaceFile": "Replace file",
    "discover.upload.cancelUpload": "Cancel upload",
    "discover.upload.retryUpload": "Retry upload",
    "discover.upload.altPreview": "Preview of uploaded image",
    "discover.upload.errors.invalidType": "Unsupported file type. Accepted formats: JPEG, PNG, WebP",
    "discover.upload.errors.tooLarge": "File too large. Maximum size: 10 MB",
    "discover.upload.errors.multipleFiles": "Please upload one file at a time",
    "discover.upload.errors.uploadFailed": "Upload failed. Please try again.",
    // discover.audio.*
    "discover.audio.title": "Record Your Voice",
    "discover.audio.startRecording": "Start Recording",
    "discover.audio.stopRecording": "Stop Recording",
    "discover.audio.restartRecording": "Record Again",
    "discover.audio.recording": "Recording...",
    "discover.audio.recordingComplete": "Recording complete!",
    "discover.audio.playback": "Listen to your recording",
    "discover.audio.uploading": "Uploading your recording...",
    "discover.audio.uploadComplete": "Recording uploaded!",
    "discover.audio.acceptedFormats": "Accepted: MP3, WAV, M4A (max 5 MB)",
    "discover.audio.uploadFile": "Or upload an audio file",
    "discover.audio.errors.permissionDenied": "Microphone access is needed to record. Please allow microphone access in your browser settings and try again.",
    "discover.audio.errors.unsupported": "Audio recording is not supported in your browser. Please try uploading an audio file instead.",
    "discover.audio.errors.invalidType": "Unsupported audio format. Accepted formats: MP3, WAV, M4A",
    "discover.audio.errors.tooLarge": "Audio file too large. Maximum size: 5 MB",
    "discover.audio.errors.recordingFailed": "Recording failed. Please try again.",
    // discover.progress.*
    "discover.progress.label": "Upload progress",
    "discover.progress.percent": "{percent}%",
    // discover flow selection
    "discover.title": "Discover Your Talents",
    "discover.subtitle": "Upload a drawing, photo, or record your voice to discover your unique talents!",
    "discover.flowSelection.title": "How would you like to share?",
    "discover.flowSelection.uploadArtifact": "Upload an Image",
    "discover.flowSelection.uploadArtifactDesc": "Share a drawing, painting, photo, or any creative work",
    "discover.flowSelection.recordAudio": "Record Your Voice",
    "discover.flowSelection.recordAudioDesc": "Tell us about your interests, sing, or share a story",
    "discover.flowSelection.back": "Back to choices",
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
    usePathname: () => "/en/discover",
    useRouter: () => ({
      push: vi.fn(),
      replace: vi.fn(),
      refresh: vi.fn(),
    }),
  };
});
