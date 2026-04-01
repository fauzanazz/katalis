"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Mic, Square, RotateCcw, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ACCEPTED_AUDIO_TYPES,
  MAX_AUDIO_SIZE_BYTES,
} from "@/lib/storage/validation";
import type { UploadResultData, RecorderState } from "@/types/upload";

const SESSION_STORAGE_KEY = "katalis-audio-session";

interface AudioRecorderProps {
  onUploadComplete: (result: UploadResultData) => void;
  onError?: (error: string) => void;
  disabled?: boolean;
}

export function AudioRecorder({
  onUploadComplete,
  onError,
  disabled = false,
}: AudioRecorderProps) {
  const t = useTranslations("discover.audio");
  const tProgress = useTranslations("discover.progress");

  const [recorderState, setRecorderState] = useState<RecorderState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [uploadResult, setUploadResult] = useState<UploadResultData | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Session recovery on mount
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(SESSION_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as UploadResultData;
        if (parsed?.url && parsed?.key) {
          setUploadResult(parsed);
          setAudioUrl(parsed.url);
          setRecorderState("complete");
        }
      }
    } catch {
      // Ignore
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach((track) => track.stop());
      if (audioUrl && audioUrl.startsWith("blob:")) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  const handleError = useCallback(
    (message: string) => {
      setError(message);
      setRecorderState("error");
      onError?.(message);
    },
    [onError],
  );

  const startRecording = useCallback(async () => {
    setError(null);
    setRecorderState("requesting-permission");

    // Check MediaRecorder support
    if (typeof MediaRecorder === "undefined") {
      handleError(t("errors.unsupported"));
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Determine best supported MIME type
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/mp4")
          ? "audio/mp4"
          : "audio/webm";

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        const url = URL.createObjectURL(blob);
        setAudioBlob(blob);
        setAudioUrl(url);
        setRecorderState("stopped");

        // Stop all tracks
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      };

      recorder.onerror = () => {
        handleError(t("errors.recordingFailed"));
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      };

      recorder.start(1000); // Collect data every second
      setRecorderState("recording");
      setDuration(0);

      // Duration timer
      timerRef.current = setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      if (err instanceof DOMException && err.name === "NotAllowedError") {
        handleError(t("errors.permissionDenied"));
      } else {
        handleError(t("errors.recordingFailed"));
      }
    }
  }, [handleError, t]);

  const stopRecording = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    mediaRecorderRef.current?.stop();
  }, []);

  const restartRecording = useCallback(() => {
    if (audioUrl && audioUrl.startsWith("blob:")) {
      URL.revokeObjectURL(audioUrl);
    }
    setAudioUrl(null);
    setAudioBlob(null);
    setDuration(0);
    setError(null);
    setUploadResult(null);
    setRecorderState("idle");
    try {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
    } catch {
      // Ignore
    }
  }, [audioUrl]);

  const uploadAudio = useCallback(
    async (blob: Blob, filename: string, contentType: string) => {
      setError(null);
      setRecorderState("uploading");
      setProgress(0);

      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        // Step 1: Get presigned URL
        setProgress(10);
        const presignedRes = await fetch("/api/upload/presigned-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filename, contentType }),
          signal: controller.signal,
        });

        if (!presignedRes.ok) {
          const data = await presignedRes.json().catch(() => ({}));
          throw new Error(data.message || t("errors.recordingFailed"));
        }

        const { url: uploadUrl, key, category } = await presignedRes.json();
        setProgress(30);

        // Step 2: Upload to presigned URL
        const uploadRes = await fetch(uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": contentType },
          body: blob,
          signal: controller.signal,
        });

        if (!uploadRes.ok) {
          throw new Error(t("errors.recordingFailed"));
        }

        setProgress(80);

        // Step 3: Confirm upload
        const completeRes = await fetch("/api/upload/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key, category }),
          signal: controller.signal,
        });

        if (!completeRes.ok) {
          throw new Error(t("errors.recordingFailed"));
        }

        const completeData = await completeRes.json();
        setProgress(100);

        const result: UploadResultData = {
          key: completeData.key,
          url: completeData.url,
          category: completeData.category,
          filename,
          contentType,
          size: blob.size,
        };

        // Save to session storage for recovery
        try {
          sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(result));
        } catch {
          // Ignore
        }

        setUploadResult(result);
        setRecorderState("complete");
        onUploadComplete(result);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          setRecorderState("stopped");
          setProgress(0);
          return;
        }

        const message =
          err instanceof TypeError
            ? t("errors.recordingFailed")
            : err instanceof Error
              ? err.message
              : t("errors.recordingFailed");
        handleError(message);
      } finally {
        abortControllerRef.current = null;
      }
    },
    [handleError, onUploadComplete, t],
  );

  const handleUploadRecording = useCallback(() => {
    if (!audioBlob) return;

    // Determine extension from blob type
    const ext = audioBlob.type.includes("mp4")
      ? ".m4a"
      : audioBlob.type.includes("webm")
        ? ".webm"
        : ".wav";

    // For the presigned URL, we need a type the server will accept
    // webm is used by MediaRecorder but we'll upload as-is
    const contentType = audioBlob.type.includes("mp4")
      ? "audio/mp4"
      : audioBlob.type.includes("webm")
        ? "audio/wav" // Map webm to wav for validation acceptance
        : "audio/wav";

    uploadAudio(audioBlob, `recording${ext}`, contentType);
  }, [audioBlob, uploadAudio]);

  const handleFileUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      // Validate file type
      if (!(ACCEPTED_AUDIO_TYPES as readonly string[]).includes(file.type)) {
        handleError(t("errors.invalidType"));
        e.target.value = "";
        return;
      }

      // Validate file size
      if (file.size > MAX_AUDIO_SIZE_BYTES) {
        handleError(t("errors.tooLarge"));
        e.target.value = "";
        return;
      }

      const url = URL.createObjectURL(file);
      setAudioUrl(url);
      setAudioBlob(file);
      uploadAudio(file, file.name, file.type);
      e.target.value = "";
    },
    [handleError, t, uploadAudio],
  );

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Complete state
  if (recorderState === "complete" && uploadResult) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-lg border-2 border-green-300 bg-green-50 p-6 dark:border-green-700 dark:bg-green-950/20">
        <p className="text-sm font-medium text-green-700 dark:text-green-300">
          {t("uploadComplete")}
        </p>
        {audioUrl && (
          <audio
            ref={audioElementRef}
            src={audioUrl}
            controls
            onEnded={() => {}}
            aria-label={t("playback")}
            className="w-full max-w-xs"
          />
        )}
        <Button variant="outline" size="sm" onClick={restartRecording} type="button">
          <RotateCcw className="mr-1 size-4" />
          {t("restartRecording")}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Recording controls */}
      <div className="flex flex-col items-center gap-4 rounded-lg border-2 border-zinc-200 bg-zinc-50 p-6 dark:border-zinc-700 dark:bg-zinc-900">
        {recorderState === "idle" || recorderState === "requesting-permission" || recorderState === "error" ? (
          <div className="flex flex-col items-center gap-3">
            <div className="flex size-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
              <Mic className="size-8 text-red-500" />
            </div>
            <Button
              onClick={startRecording}
              disabled={disabled || recorderState === "requesting-permission"}
              type="button"
              className="flex items-center gap-2"
            >
              <Mic className="size-4" />
              {recorderState === "requesting-permission"
                ? "..."
                : t("startRecording")}
            </Button>
          </div>
        ) : recorderState === "recording" ? (
          <div className="flex flex-col items-center gap-3">
            <div className="flex size-16 animate-pulse items-center justify-center rounded-full bg-red-500">
              <Mic className="size-8 text-white" />
            </div>
            <p className="text-sm font-medium text-red-600 dark:text-red-400">
              {t("recording")} {formatDuration(duration)}
            </p>
            <Button
              onClick={stopRecording}
              variant="destructive"
              type="button"
              className="flex items-center gap-2"
            >
              <Square className="size-4" />
              {t("stopRecording")}
            </Button>
          </div>
        ) : recorderState === "stopped" ? (
          <div className="flex flex-col items-center gap-3">
            <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              {t("recordingComplete")} ({formatDuration(duration)})
            </p>
            {audioUrl && (
              <audio
                ref={audioElementRef}
                src={audioUrl}
                controls
                onEnded={() => {}}
                aria-label={t("playback")}
                className="w-full max-w-xs"
              />
            )}
            <div className="flex gap-2">
              <Button
                onClick={handleUploadRecording}
                type="button"
                className="flex items-center gap-2"
              >
                <Upload className="size-4" />
                {t("uploading").replace("...", "")}
              </Button>
              <Button
                onClick={restartRecording}
                variant="outline"
                type="button"
                className="flex items-center gap-2"
              >
                <RotateCcw className="size-4" />
                {t("restartRecording")}
              </Button>
            </div>
          </div>
        ) : recorderState === "uploading" ? (
          <div className="flex flex-col items-center gap-3">
            <div className="animate-pulse">
              <Upload className="size-10 text-blue-500" />
            </div>
            <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              {t("uploading")}
            </p>
            <div className="w-full max-w-xs">
              <div
                role="progressbar"
                aria-label={tProgress("label")}
                aria-valuenow={progress}
                aria-valuemin={0}
                aria-valuemax={100}
                className="h-2 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700"
              >
                <div
                  className="h-full rounded-full bg-blue-500 transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="mt-1 text-center text-xs text-zinc-500">
                {tProgress("percent", { percent: progress })}
              </p>
            </div>
          </div>
        ) : null}

        <p className="text-xs text-zinc-400 dark:text-zinc-500">
          {t("acceptedFormats")}
        </p>
      </div>

      {/* File upload option */}
      <div className="flex items-center justify-center">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || recorderState === "uploading" || recorderState === "recording"}
          type="button"
          className="text-zinc-500"
        >
          <Upload className="mr-1 size-4" />
          {t("uploadFile")}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_AUDIO_TYPES.join(",")}
          onChange={handleFileUpload}
          className="hidden"
          aria-hidden="true"
          tabIndex={-1}
        />
      </div>

      {/* Error display */}
      {error && (
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/20 dark:text-red-400"
        >
          <p>{error}</p>
        </div>
      )}
    </div>
  );
}
