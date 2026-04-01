"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useTranslations, useLocale } from "next-intl";
import Image from "next/image";
import { BookOpen, Send, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
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
}: StoryPromptProps) {
  const t = useTranslations("discover.story");
  const locale = useLocale();

  const [storyText, setStoryText] = useState("");
  const [inputMode, setInputMode] = useState<StoryInputMode>("text");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());
  const [audioUpload, setAudioUpload] = useState<UploadResultData | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
    [images, onAnalysisComplete, onAnalysisStart, onError],
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

  return (
    <div className="flex flex-col gap-6">
      {/* Story prompt images */}
      <div>
        <h2 className="mb-3 text-center text-lg font-semibold text-zinc-800 dark:text-zinc-200">
          {t("imagePromptTitle")}
        </h2>
        <p className="mb-4 text-center text-sm text-zinc-500 dark:text-zinc-400">
          {t("imagePromptSubtitle")}
        </p>
        <div
          className="grid grid-cols-3 gap-3"
          role="group"
          aria-label={t("imageGroupLabel")}
        >
          {images.map((image) => (
            <div
              key={image.id}
              className="aspect-square overflow-hidden rounded-xl border-2 border-zinc-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
            >
              {imageErrors.has(image.id) ? (
                <div className="flex size-full items-center justify-center bg-zinc-100 dark:bg-zinc-800">
                  <ImageIcon className="size-8 text-zinc-400" />
                </div>
              ) : (
                <Image
                  src={image.src}
                  alt={locale === "id" ? image.altId : image.altEn}
                  width={400}
                  height={300}
                  className="size-full object-cover"
                  onError={() => handleImageError(image.id)}
                  unoptimized
                  priority
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Input mode toggle */}
      <div className="flex justify-center gap-2">
        <Button
          variant={inputMode === "text" ? "default" : "outline"}
          size="sm"
          onClick={() => setInputMode("text")}
          disabled={isSubmitting}
          type="button"
        >
          <BookOpen className="mr-1 size-4" />
          {t("writeStory")}
        </Button>
        <Button
          variant={inputMode === "audio" ? "default" : "outline"}
          size="sm"
          onClick={() => setInputMode("audio")}
          disabled={isSubmitting}
          type="button"
        >
          {t("recordStory")}
        </Button>
      </div>

      {/* Text story input */}
      {inputMode === "text" && (
        <div className="flex flex-col gap-3">
          <label
            htmlFor="story-text"
            className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
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
            className="min-h-[160px] w-full resize-y rounded-lg border-2 border-zinc-200 bg-white p-4 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-200 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-purple-500 dark:focus:ring-purple-800"
            maxLength={STORY_MAX_LENGTH}
          />
          <div className="flex items-center justify-between">
            <span
              id="story-char-count"
              className={`text-xs ${
                charCount < STORY_MIN_LENGTH
                  ? "text-zinc-400 dark:text-zinc-500"
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
              className="text-sm text-red-600 dark:text-red-400"
            >
              {validationError}
            </p>
          )}

          <Button
            onClick={handleTextSubmit}
            disabled={isSubmitting || !isTextValid}
            className="w-full"
            size="lg"
          >
            <Send className="mr-2 size-5" />
            {t("submitStory")}
          </Button>
        </div>
      )}

      {/* Audio story input */}
      {inputMode === "audio" && (
        <div className="flex flex-col gap-4">
          <p className="text-center text-sm text-zinc-600 dark:text-zinc-400">
            {t("audioInstructions")}
          </p>
          <AudioRecorder
            onUploadComplete={handleAudioUploadComplete}
            disabled={isSubmitting}
          />
          {audioUpload && (
            <Button
              onClick={handleAudioSubmit}
              disabled={isSubmitting}
              className="w-full"
              size="lg"
            >
              <Send className="mr-2 size-5" />
              {t("submitStory")}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
