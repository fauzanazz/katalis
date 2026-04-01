"use client";

import { useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { ImageIcon, Mic, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UploadZone } from "@/components/upload/UploadZone";
import { AudioRecorder } from "@/components/upload/AudioRecorder";
import type { UploadResultData } from "@/types/upload";

type DiscoveryFlow = "selection" | "image" | "audio";

export default function DiscoverPage() {
  const t = useTranslations("discover");

  const [flow, setFlow] = useState<DiscoveryFlow>("selection");

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleUploadComplete = useCallback((_result: UploadResultData) => {
    // Upload result stored by child components via session storage.
    // The discovery-ai-analysis feature will use this for analysis.
  }, []);

  const handleBack = useCallback(() => {
    setFlow("selection");
  }, []);

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:py-12">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl dark:text-zinc-50">
          {t("title")}
        </h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          {t("subtitle")}
        </p>
      </div>

      {flow === "selection" && (
        <div className="flex flex-col gap-4">
          <h2 className="text-center text-lg font-semibold text-zinc-800 dark:text-zinc-200">
            {t("flowSelection.title")}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Image upload option */}
            <button
              type="button"
              onClick={() => setFlow("image")}
              className="flex flex-col items-center gap-3 rounded-xl border-2 border-zinc-200 bg-white p-6 transition-all hover:border-blue-400 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-blue-500"
            >
              <div className="flex size-14 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30">
                <ImageIcon className="size-7 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                {t("flowSelection.uploadArtifact")}
              </h3>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                {t("flowSelection.uploadArtifactDesc")}
              </p>
            </button>

            {/* Audio recording option */}
            <button
              type="button"
              onClick={() => setFlow("audio")}
              className="flex flex-col items-center gap-3 rounded-xl border-2 border-zinc-200 bg-white p-6 transition-all hover:border-red-400 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-red-500"
            >
              <div className="flex size-14 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
                <Mic className="size-7 text-red-600 dark:text-red-400" />
              </div>
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                {t("flowSelection.recordAudio")}
              </h3>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                {t("flowSelection.recordAudioDesc")}
              </p>
            </button>
          </div>
        </div>
      )}

      {flow === "image" && (
        <div className="flex flex-col gap-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBack}
            type="button"
            className="self-start"
          >
            <ArrowLeft className="mr-1 size-4" />
            {t("flowSelection.back")}
          </Button>
          <UploadZone onUploadComplete={handleUploadComplete} />
        </div>
      )}

      {flow === "audio" && (
        <div className="flex flex-col gap-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBack}
            type="button"
            className="self-start"
          >
            <ArrowLeft className="mr-1 size-4" />
            {t("flowSelection.back")}
          </Button>
          <AudioRecorder onUploadComplete={handleUploadComplete} />
        </div>
      )}
    </div>
  );
}
