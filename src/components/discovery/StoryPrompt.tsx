"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useTranslations, useLocale } from "next-intl";
import Image from "next/image";
import { BookOpen, Send, ImageIcon, X, ZoomIn } from "lucide-react";
import { AudioRecorder } from "@/components/upload/AudioRecorder";
import { STORY_MIN_LENGTH, STORY_MAX_LENGTH } from "@/lib/ai/story-schemas";
import type { StoryPromptImage } from "@/lib/story-prompts";
import type { UploadResultData } from "@/types/upload";
import type { AnalysisOutput } from "@/lib/ai/schemas";

type StoryInputMode = "text" | "audio";

interface StoryPromptProps {
  images: StoryPromptImage[];
  onAnalysisComplete: (results: AnalysisOutput) => void;
  onAnalysisStart: () => void;
  onError: (errorType: "ai_failure" | "timeout" | "network") => void;
  /** Optional gate run before submit; abort submission if it returns false. */
  beforeSubmit?: () => Promise<boolean> | boolean;
  /** Optional guest DoB (ISO) sent to backend for age-band gating. */
  guestDob?: string | null;
}

/**
 * Story Prompting component for the discovery flow.
 *
 * Presents 3 random images and lets the child create a story
 * either by typing text or recording audio. On submit, sends
 * the story to Claude for narrative pattern analysis.
 */
export function StoryPrompt({
  images,
  onAnalysisComplete,
  onAnalysisStart,
  onError,
  beforeSubmit,
  guestDob,
}: StoryPromptProps) {
  const t = useTranslations("discover.story");
  const locale = useLocale();

  const [storyText, setStoryText] = useState("");
  const [inputMode, setInputMode] = useState<StoryInputMode>("text");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());
  const [audioUpload, setAudioUpload] = useState<UploadResultData | null>(null);
  const [lightboxImage, setLightboxImage] = useState<StoryPromptImage | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!lightboxImage) return;
    closeBtnRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightboxImage(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxImage]);

  // Track story text for preserved retry
  const storyTextRef = useRef(storyText);
  useEffect(() => {
    storyTextRef.current = storyText;
  }, [storyText]);

  const charCount = storyText.length;
  const isTextValid = charCount >= STORY_MIN_LENGTH && charCount <= STORY_MAX_LENGTH;

  const handleTextChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = e.target.value;
      if (value.length <= STORY_MAX_LENGTH) {
        setStoryText(value);
        setValidationError(null);
      }
    },
    [],
  );

  const handleImageError = useCallback((imageId: string) => {
    setImageErrors((prev) => new Set(prev).add(imageId));
  }, []);

  const submitStoryAnalysis = useCallback(
    async (text: string, submissionType: "text" | "audio") => {
      if (beforeSubmit) {
        const allowed = await beforeSubmit();
        if (!allowed) return;
      }

      setIsSubmitting(true);
      setValidationError(null);
      onAnalysisStart();

      try {
        const response = await fetch("/api/discovery/analyze-story", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            storyText: text,
            imageIds: images.map((img) => img.id),
            submissionType,
            ...(guestDob ? { guestDob } : {}),
          }),
        });

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          if (response.status === 504 || data.error === "timeout") {
            onError("timeout");
          } else {
            onError("ai_failure");
          }
          setIsSubmitting(false);
          return;
        }

        const data: AnalysisOutput = await response.json();
        onAnalysisComplete(data);
      } catch {
        onError("network");
      } finally {
        setIsSubmitting(false);
      }
    },
    [images, onAnalysisComplete, onAnalysisStart, onError, beforeSubmit, guestDob],
  );

  const handleTextSubmit = useCallback(() => {
    if (storyText.length < STORY_MIN_LENGTH) {
      setValidationError(
        t("validation.tooShort", { min: STORY_MIN_LENGTH }),
      );
      return;
    }
    if (storyText.length > STORY_MAX_LENGTH) {
      setValidationError(
        t("validation.tooLong", { max: STORY_MAX_LENGTH }),
      );
      return;
    }
    submitStoryAnalysis(storyText, "text");
  }, [storyText, submitStoryAnalysis, t]);

  const handleAudioUploadComplete = useCallback(
    (result: UploadResultData) => {
      setAudioUpload(result);
    },
    [],
  );

  const handleAudioSubmit = useCallback(() => {
    if (audioUpload) {
      // For audio stories, we send a placeholder text since Claude mock
      // will use the submissionType to determine analysis approach
      submitStoryAnalysis(
        `[Audio story recording - ${audioUpload.filename}]`,
        "audio",
      );
    }
  }, [audioUpload, submitStoryAnalysis]);

  const imgAlt = useCallback(
    (image: StoryPromptImage) =>
      locale === "zh" ? image.altZh : locale === "id" ? image.altId : image.altEn,
    [locale],
  );

  return (
    <>
      {/* Image lightbox modal */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label={imgAlt(lightboxImage)}
          onClick={() => setLightboxImage(null)}
        >
          <div
            className="relative max-h-[90vh] max-w-[92vw] sm:max-w-[80vw] lg:max-w-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              ref={closeBtnRef}
              onClick={() => setLightboxImage(null)}
              className="absolute -right-3 -top-3 z-10 flex size-8 items-center justify-center rounded-full bg-white shadow-lg ring-1 ring-black/10 transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-yellow-400"
              aria-label="Close"
              type="button"
            >
              <X className="size-4 text-ink" />
            </button>
            {imageErrors.has(lightboxImage.id) ? (
              <div className="flex size-64 items-center justify-center rounded-2xl bg-muted">
                <ImageIcon className="size-12 text-zinc-400" />
              </div>
            ) : (
              <Image
                src={lightboxImage.src}
                alt={imgAlt(lightboxImage)}
                width={900}
                height={680}
                className="max-h-[85vh] w-full rounded-2xl object-contain shadow-2xl"
                unoptimized
                priority
              />
            )}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-6">
        {/* Story prompt images */}
        <div>
          <h2 className="mb-3 text-center text-lg font-semibold text-ink">
            {t("imagePromptTitle")}
          </h2>
          <p className="mb-4 text-center text-sm text-muted-foreground">
            {t("imagePromptSubtitle")}
          </p>
          <div
            className="grid grid-cols-3 gap-3"
            role="group"
            aria-label={t("imageGroupLabel")}
          >
            {images.map((image) => (
              <button
                key={image.id}
                type="button"
                aria-label={`${imgAlt(image)} — ${t("imageExpandLabel")}`}
                onClick={() => !imageErrors.has(image.id) && setLightboxImage(image)}
                className="group aspect-square overflow-hidden rounded-xl border-2 border-border bg-card shadow-sm transition-all duration-200 hover:scale-[1.03] hover:border-yellow-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:ring-offset-2"
              >
                {imageErrors.has(image.id) ? (
                  <div className="flex size-full items-center justify-center bg-muted">
                    <ImageIcon className="size-8 text-zinc-400" />
                  </div>
                ) : (
                  <div className="relative size-full">
                    <Image
                      src={image.src}
                      alt={imgAlt(image)}
                      width={400}
                      height={300}
                      className="size-full object-cover"
                      onError={() => handleImageError(image.id)}
                      unoptimized
                      priority
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors duration-200 group-hover:bg-black/20">
                      <ZoomIn className="size-7 scale-0 text-white drop-shadow transition-transform duration-200 group-hover:scale-100" aria-hidden />
                    </div>
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Input mode toggle */}
        <div className="flex justify-center gap-2">
          <button
            type="button"
            onClick={() => setInputMode("text")}
            disabled={isSubmitting}
            className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:ring-offset-2 disabled:opacity-50 ${
              inputMode === "text"
                ? "bg-yellow-sun-deep text-white shadow-sm"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            <BookOpen className="size-4" />
            {t("writeStory")}
          </button>
          <button
            type="button"
            onClick={() => setInputMode("audio")}
            disabled={isSubmitting}
            className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:ring-offset-2 disabled:opacity-50 ${
              inputMode === "audio"
                ? "bg-yellow-sun-deep text-white shadow-sm"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {t("recordStory")}
          </button>
        </div>

        {/* Text story input */}
        {inputMode === "text" && (
          <div className="flex flex-col gap-3">
            <label
              htmlFor="story-text"
              className="text-sm font-medium text-foreground"
            >
              {t("textLabel")}
            </label>
            <textarea
              ref={textareaRef}
              id="story-text"
              value={storyText}
              onChange={handleTextChange}
              placeholder={t("textPlaceholder")}
              disabled={isSubmitting}
              aria-label={t("textLabel")}
              aria-describedby="story-char-count story-validation-error"
              aria-invalid={validationError ? "true" : undefined}
              className="min-h-[160px] w-full resize-y rounded-2xl border-2 border-yellow-200 bg-gradient-to-br from-white to-amber-50/30 p-4 text-sm text-ink placeholder:text-zinc-400 focus:border-yellow-400 focus:outline-none focus:ring-2 focus:ring-yellow-100 disabled:opacity-50"
              maxLength={STORY_MAX_LENGTH}
            />
            <div className="flex items-center justify-between">
              <span
                id="story-char-count"
                className={`text-xs ${
                  charCount < STORY_MIN_LENGTH
                    ? "text-zinc-400"
                    : charCount > STORY_MAX_LENGTH * 0.9
                      ? "text-amber-500"
                      : "text-green-500"
                }`}
              >
                {t("charCount", {
                  count: charCount,
                  min: STORY_MIN_LENGTH,
                  max: STORY_MAX_LENGTH,
                })}
              </span>
            </div>

            {/* Validation error */}
            {validationError && (
              <p
                id="story-validation-error"
                role="alert"
                className="text-sm text-red-600"
              >
                {validationError}
              </p>
            )}

            <button
              type="button"
              onClick={handleTextSubmit}
              disabled={isSubmitting || !isTextValid}
              className="group/btn relative flex h-[52px] w-full items-center justify-center gap-2 overflow-hidden rounded-2xl bg-gradient-to-r from-yellow-sun-deep to-yellow-sun-light text-base font-bold text-white shadow-sm transition-all duration-200 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <div className="absolute inset-0 flex h-full w-full justify-center [transform:skew(-13deg)_translateX(-100%)] group-hover/btn:duration-700 group-hover/btn:[transform:skew(-13deg)_translateX(100%)]">
                <div className="relative h-full w-10 bg-white/25" />
              </div>
              <Send className="size-5" />
              {t("submitStory")}
            </button>
          </div>
        )}

        {/* Audio story input */}
        {inputMode === "audio" && (
          <div className="flex flex-col gap-4">
            <p className="text-center text-sm text-muted-foreground">
              {t("audioInstructions")}
            </p>
            <AudioRecorder
              onUploadComplete={handleAudioUploadComplete}
              disabled={isSubmitting}
            />
            {audioUpload && (
              <button
                type="button"
                onClick={handleAudioSubmit}
                disabled={isSubmitting}
                className="group/btn relative flex h-[52px] w-full items-center justify-center gap-2 overflow-hidden rounded-2xl bg-gradient-to-r from-yellow-sun-deep to-yellow-sun-light text-base font-bold text-white shadow-sm transition-all duration-200 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <div className="absolute inset-0 flex h-full w-full justify-center [transform:skew(-13deg)_translateX(-100%)] group-hover/btn:duration-700 group-hover/btn:[transform:skew(-13deg)_translateX(100%)]">
                  <div className="relative h-full w-10 bg-white/25" />
                </div>
                <Send className="size-5" />
                {t("submitStory")}
              </button>
            )}
          </div>
        )}
      </div>
    </>
  );
}
