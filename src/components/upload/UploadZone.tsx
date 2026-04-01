"use client";

import {
  useState,
  useRef,
  useCallback,
  useEffect,
  type DragEvent,
  type ChangeEvent,
} from "react";
import { useTranslations } from "next-intl";
import { Upload, Camera, X, RefreshCw, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ACCEPTED_IMAGE_TYPES,
  MAX_IMAGE_SIZE_BYTES,
} from "@/lib/storage/validation";
import type { UploadResultData, UploadState } from "@/types/upload";

const SESSION_STORAGE_KEY = "katalis-upload-session";

interface UploadZoneProps {
  onUploadComplete: (result: UploadResultData) => void;
  onError?: (error: string) => void;
  disabled?: boolean;
}

export function UploadZone({
  onUploadComplete,
  onError,
  disabled = false,
}: UploadZoneProps) {
  const t = useTranslations("discover.upload");
  const tProgress = useTranslations("discover.progress");

  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploadResult, setUploadResult] = useState<UploadResultData | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Session recovery: check for pending upload on mount
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(SESSION_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as UploadResultData;
        if (parsed?.url && parsed?.key) {
          setUploadResult(parsed);
          setPreview(parsed.url);
          setUploadState("complete");
        }
      }
    } catch {
      // Ignore invalid session storage
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const handleError = useCallback(
    (message: string) => {
      setError(message);
      setUploadState("error");
      onError?.(message);
    },
    [onError],
  );

  const validateFile = useCallback(
    (file: File): string | null => {
      // Check file type
      if (
        !(ACCEPTED_IMAGE_TYPES as readonly string[]).includes(file.type)
      ) {
        return t("errors.invalidType");
      }
      // Check file size
      if (file.size > MAX_IMAGE_SIZE_BYTES) {
        return t("errors.tooLarge");
      }
      return null;
    },
    [t],
  );

  const uploadFile = useCallback(
    async (file: File) => {
      clearError();
      setUploadState("validating");

      // Client-side validation
      const validationError = validateFile(file);
      if (validationError) {
        handleError(validationError);
        return;
      }

      setUploadState("uploading");
      setProgress(0);

      // Create a preview
      const objectUrl = URL.createObjectURL(file);
      setPreview(objectUrl);

      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        // Step 1: Get presigned URL
        setProgress(10);
        const presignedRes = await fetch("/api/upload/presigned-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filename: file.name,
            contentType: file.type,
          }),
          signal: controller.signal,
        });

        if (!presignedRes.ok) {
          const data = await presignedRes.json().catch(() => ({}));
          throw new Error(data.message || t("errors.uploadFailed"));
        }

        const { url: uploadUrl, key, category } = await presignedRes.json();
        setProgress(30);

        // Step 2: Upload file to presigned URL
        const uploadRes = await fetch(uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": file.type },
          body: file,
          signal: controller.signal,
        });

        if (!uploadRes.ok) {
          throw new Error(t("errors.uploadFailed"));
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
          throw new Error(t("errors.uploadFailed"));
        }

        const completeData = await completeRes.json();
        setProgress(100);

        const result: UploadResultData = {
          key: completeData.key,
          url: completeData.url,
          category: completeData.category,
          filename: file.name,
          contentType: file.type,
          size: file.size,
        };

        // Save to session storage for recovery
        try {
          sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(result));
        } catch {
          // Ignore storage errors
        }

        setUploadResult(result);
        setUploadState("complete");
        onUploadComplete(result);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          setUploadState("idle");
          setPreview(null);
          setProgress(0);
          return;
        }

        const message =
          err instanceof TypeError
            ? t("networkError")
            : err instanceof Error
              ? err.message
              : t("errors.uploadFailed");
        handleError(message);
      } finally {
        abortControllerRef.current = null;
      }
    },
    [clearError, validateFile, handleError, onUploadComplete, t],
  );

  const handleDragOver = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      if (!disabled && uploadState !== "uploading") {
        setIsDragOver(true);
      }
    },
    [disabled, uploadState],
  );

  const handleDragLeave = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
    },
    [],
  );

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      if (disabled || uploadState === "uploading") return;

      const files = e.dataTransfer.files;
      if (files.length > 1) {
        handleError(t("errors.multipleFiles"));
        return;
      }

      if (files.length === 1) {
        uploadFile(files[0]);
      }
    },
    [disabled, uploadState, handleError, t, uploadFile],
  );

  const handleFileChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        if (files.length > 1) {
          handleError(t("errors.multipleFiles"));
          return;
        }
        uploadFile(files[0]);
      }
      // Reset input so re-selecting same file works
      e.target.value = "";
    },
    [handleError, t, uploadFile],
  );

  const handleCancelUpload = useCallback(() => {
    abortControllerRef.current?.abort();
    setUploadState("idle");
    setPreview(null);
    setProgress(0);
    setError(null);
  }, []);

  const handleRemoveFile = useCallback(() => {
    setUploadResult(null);
    setPreview(null);
    setUploadState("idle");
    setProgress(0);
    setError(null);
    try {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
    } catch {
      // Ignore
    }
  }, []);

  const handleRetry = useCallback(() => {
    setError(null);
    setUploadState("idle");
    setProgress(0);
    // Keep preview if available
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        fileInputRef.current?.click();
      }
    },
    [],
  );

  // Upload complete state: show preview
  if (uploadState === "complete" && uploadResult && preview) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-lg border-2 border-green-300 bg-green-50 p-6 dark:border-green-700 dark:bg-green-950/20">
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview}
            alt={t("altPreview")}
            className="max-h-48 max-w-full rounded-lg object-contain"
          />
        </div>
        <p className="text-sm font-medium text-green-700 dark:text-green-300">
          {t("uploadComplete")}
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRemoveFile}
            type="button"
          >
            <X className="mr-1 size-4" />
            {t("removeFile")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              handleRemoveFile();
              fileInputRef.current?.click();
            }}
            type="button"
          >
            <RefreshCw className="mr-1 size-4" />
            {t("replaceFile")}
          </Button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_IMAGE_TYPES.join(",")}
          onChange={handleFileChange}
          className="hidden"
          aria-hidden="true"
          tabIndex={-1}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Drop zone */}
      <div
        role="button"
        tabIndex={disabled || uploadState === "uploading" ? -1 : 0}
        aria-label={t("dropzone")}
        aria-disabled={disabled || uploadState === "uploading"}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => {
          if (!disabled && uploadState !== "uploading") {
            fileInputRef.current?.click();
          }
        }}
        onKeyDown={handleKeyDown}
        className={`
          relative flex min-h-[200px] cursor-pointer flex-col items-center justify-center 
          rounded-lg border-2 border-dashed p-6 transition-all duration-200
          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
          ${
            isDragOver
              ? "border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-950/20"
              : "border-zinc-300 bg-zinc-50 hover:border-zinc-400 hover:bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-900 dark:hover:border-zinc-500 dark:hover:bg-zinc-800"
          }
          ${(disabled || uploadState === "uploading") ? "cursor-not-allowed opacity-50" : ""}
        `}
      >
        {uploadState === "uploading" ? (
          <div className="flex flex-col items-center gap-3">
            <div className="animate-pulse">
              <Upload className="size-10 text-blue-500" />
            </div>
            <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              {t("uploading")}
            </p>
            {/* Progress bar */}
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
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                handleCancelUpload();
              }}
              type="button"
            >
              {t("cancelUpload")}
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            {isDragOver ? (
              <>
                <ImageIcon className="size-10 text-blue-500" />
                <p className="text-sm font-medium text-blue-600 dark:text-blue-400">
                  {t("dropzoneActive")}
                </p>
              </>
            ) : (
              <>
                <Upload className="size-10 text-zinc-400 dark:text-zinc-500" />
                {/* Desktop text */}
                <p className="hidden text-sm font-medium text-zinc-700 sm:block dark:text-zinc-300">
                  {t("dropzone")}
                </p>
                <p className="hidden text-xs text-zinc-500 sm:block dark:text-zinc-400">
                  {t("clickToUpload")}
                </p>
                {/* Mobile text */}
                <p className="text-sm font-medium text-zinc-700 sm:hidden dark:text-zinc-300">
                  {t("tapToUpload")}
                </p>
              </>
            )}
            <p className="text-xs text-zinc-400 dark:text-zinc-500">
              {t("acceptedFormats")}
            </p>
          </div>
        )}
      </div>

      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_IMAGE_TYPES.join(",")}
        onChange={handleFileChange}
        className="hidden"
        aria-hidden="true"
        tabIndex={-1}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
        aria-hidden="true"
        tabIndex={-1}
      />

      {/* Camera capture button (shown on all viewports, useful for mobile) */}
      <Button
        variant="outline"
        onClick={() => cameraInputRef.current?.click()}
        disabled={disabled || uploadState === "uploading"}
        type="button"
        className="flex items-center gap-2 sm:hidden"
      >
        <Camera className="size-4" />
        {t("cameraCapture")}
      </Button>

      {/* Error display */}
      {error && (
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/20 dark:text-red-400"
        >
          <p>{error}</p>
          {uploadState === "error" && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRetry}
              className="mt-2"
              type="button"
            >
              {t("retryUpload")}
            </Button>
          )}
        </div>
      )}

      {/* Uploading preview */}
      {preview && uploadState === "uploading" && (
        <div className="flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview}
            alt={t("altPreview")}
            className="max-h-32 max-w-full rounded-lg object-contain opacity-50"
          />
        </div>
      )}
    </div>
  );
}
