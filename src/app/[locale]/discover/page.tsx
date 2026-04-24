"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { useTranslations } from "next-intl";
import { ImageIcon, Mic, ArrowLeft, Sparkles, BookOpen, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UploadZone } from "@/components/upload/UploadZone";
import { AudioRecorder } from "@/components/upload/AudioRecorder";
import { AnalysisResults } from "@/components/discovery/AnalysisResults";
import { AnalysisLoading } from "@/components/discovery/AnalysisLoading";
import { AnalysisError } from "@/components/discovery/AnalysisError";
import { StoryPrompt } from "@/components/discovery/StoryPrompt";
import { getRandomStoryPrompts } from "@/lib/story-prompts";
import { useRouter } from "@/i18n/navigation";
import type { UploadResultData } from "@/types/upload";
import type { AnalysisOutput } from "@/lib/ai/schemas";

type DiscoveryFlow = "selection" | "image" | "audio" | "story";
type AnalysisState = "idle" | "analyzing" | "done" | "error";
type ErrorType = "ai_failure" | "timeout" | "network" | "content_blocked";
type AuthState = "loading" | "child" | "parent" | "unauthenticated";

/**
 * Saves discovery results to the database via API.
 * Returns the discovery ID on success, or null on failure.
 */
async function saveDiscoveryResults(
  type: "artifact" | "story",
  talents: AnalysisOutput["talents"],
  fileUrl?: string,
): Promise<string | null> {
  try {
    const res = await fetch("/api/discovery/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, fileUrl, talents }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.id ?? null;
  } catch {
    return null;
  }
}

export default function DiscoverPage() {
  const t = useTranslations("discover");
  const router = useRouter();

  const [authState, setAuthState] = useState<AuthState>("loading");
  const [flow, setFlow] = useState<DiscoveryFlow>("selection");
  const [analysisState, setAnalysisState] = useState<AnalysisState>("idle");
  const [analysisResults, setAnalysisResults] = useState<AnalysisOutput | null>(null);
  const [errorType, setErrorType] = useState<ErrorType>("ai_failure");
  const [currentUpload, setCurrentUpload] = useState<UploadResultData | null>(null);

  // Generate random story prompt images once per story flow entry
  const storyImages = useMemo(() => getRandomStoryPrompts(3), []);

  // Check session type on mount
  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch("/api/auth/session");
        const data = await res.json();
        if (!data.authenticated) {
          setAuthState("unauthenticated");
        } else if (data.type === "user") {
          setAuthState("parent");
        } else {
          setAuthState("child");
        }
      } catch {
        setAuthState("unauthenticated");
      }
    }
    checkAuth();
  }, []);

  const runAnalysis = useCallback(async (upload: UploadResultData) => {
    setAnalysisState("analyzing");
    setAnalysisResults(null);

    try {
      const response = await fetch("/api/discovery/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          artifactUrl: upload.url,
          artifactType: upload.category,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        if (response.status === 504 || data.error === "timeout") {
          setErrorType("timeout");
        } else if (response.status === 403 || data.error === "content_blocked") {
          setErrorType("content_blocked");
        } else {
          setErrorType("ai_failure");
        }
        setAnalysisState("error");
        return;
      }

      const data: AnalysisOutput = await response.json();

      // Save to DB and redirect to results page
      const discoveryId = await saveDiscoveryResults(
        "artifact",
        data.talents,
        upload.url,
      );
      if (discoveryId) {
        router.push(`/discover/results/${discoveryId}`);
        return;
      }

      // Fallback: show inline results if save fails
      setAnalysisResults(data);
      setAnalysisState("done");
    } catch {
      setErrorType("network");
      setAnalysisState("error");
    }
  }, [router]);

  const handleUploadComplete = useCallback(
    (result: UploadResultData) => {
      setCurrentUpload(result);
    },
    [],
  );

  const handleAnalyze = useCallback(() => {
    if (currentUpload) {
      runAnalysis(currentUpload);
    }
  }, [currentUpload, runAnalysis]);

  const handleRetry = useCallback(() => {
    if (currentUpload) {
      runAnalysis(currentUpload);
    } else {
      // For story flow retry, go back to idle so user can resubmit
      setAnalysisState("idle");
    }
  }, [currentUpload, runAnalysis]);

  const handleBack = useCallback(() => {
    setFlow("selection");
    setAnalysisState("idle");
    setAnalysisResults(null);
    setCurrentUpload(null);
  }, []);

  const handleNewDiscovery = useCallback(() => {
    setFlow("selection");
    setAnalysisState("idle");
    setAnalysisResults(null);
    setCurrentUpload(null);
  }, []);

  // Story flow callbacks
  const handleStoryAnalysisComplete = useCallback(
    (results: AnalysisOutput) => {
      // Save story analysis results to DB and redirect
      saveDiscoveryResults("story", results.talents).then((discoveryId) => {
        if (discoveryId) {
          router.push(`/discover/results/${discoveryId}`);
          return;
        }
        // Fallback: show inline if save fails
        setAnalysisResults(results);
        setAnalysisState("done");
      });
    },
    [router],
  );

  const handleStoryAnalysisStart = useCallback(() => {
    setAnalysisState("analyzing");
    setAnalysisResults(null);
  }, []);

  const handleStoryError = useCallback(
    (type: ErrorType) => {
      setErrorType(type);
      setAnalysisState("error");
    },
    [],
  );

  // Loading state while checking auth
  if (authState === "loading") {
    return (
      <div className="mx-auto flex min-h-[50vh] w-full max-w-2xl items-center justify-center px-4">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  // Parent session - needs to select a child first
  if (authState === "parent") {
    return (
      <div className="mx-auto w-full max-w-md px-4 py-12 sm:py-16">
        <div className="flex flex-col items-center gap-6 text-center">
          <div className="flex size-16 items-center justify-center rounded-full bg-amber-100">
            <Users className="size-8 text-amber-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-ink">
              {t("parentAuth.title")}
            </h1>
            <p className="mt-2 text-muted-foreground">
              {t("parentAuth.message")}
            </p>
          </div>
          <Button onClick={() => router.push("/parent")} size="lg">
            {t("parentAuth.goToParent")}
          </Button>
          <p className="text-sm text-muted-foreground">
            {t("parentAuth.hint")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:py-12 bg-gradient-to-b from-amber-50 to-orange-100 min-h-screen rounded-2xl">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-ink sm:text-4xl">
          {t("title")}
        </h1>
        <p className="mt-2 text-muted-foreground">
          {t("subtitle")}
        </p>
      </div>

      {/* Results display */}
      {analysisState === "done" && analysisResults && (
        <div className="flex flex-col gap-6">
          <AnalysisResults results={analysisResults} />
          <div className="flex justify-center">
            <Button onClick={handleNewDiscovery} variant="outline">
              {t("analysis.discoverAgain")}
            </Button>
          </div>
        </div>
      )}

      {/* Loading state */}
      {analysisState === "analyzing" && <AnalysisLoading />}

      {/* Error state */}
      {analysisState === "error" && (
        <AnalysisError errorType={errorType} onRetry={handleRetry} />
      )}

      {/* Flow selection */}
      {analysisState === "idle" && flow === "selection" && (
        <div className="flex flex-col gap-4">
          <h2 className="text-center text-lg font-semibold text-ink">
            {t("flowSelection.title")}
          </h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {/* Image upload option */}
            <button
              type="button"
              onClick={() => setFlow("image")}
              className="flex flex-col items-center gap-3 rounded-xl border-2 border-border bg-card p-6 transition-all hover:border-amber-400 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2"
            >
              <div className="flex size-14 items-center justify-center rounded-full bg-amber-100">
                <ImageIcon className="size-7 text-amber-600" />
              </div>
              <h3 className="text-lg font-semibold text-ink">
                {t("flowSelection.uploadArtifact")}
              </h3>
              <p className="text-sm text-muted-foreground">
                {t("flowSelection.uploadArtifactDesc")}
              </p>
            </button>

            {/* Audio recording option */}
            <button
              type="button"
              onClick={() => setFlow("audio")}
              className="flex flex-col items-center gap-3 rounded-xl border-2 border-border bg-card p-6 transition-all hover:border-red-400 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
            >
              <div className="flex size-14 items-center justify-center rounded-full bg-red-100">
                <Mic className="size-7 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-ink">
                {t("flowSelection.recordAudio")}
              </h3>
              <p className="text-sm text-muted-foreground">
                {t("flowSelection.recordAudioDesc")}
              </p>
            </button>

            {/* Story mode option */}
            <button
              type="button"
              onClick={() => setFlow("story")}
              className="flex flex-col items-center gap-3 rounded-xl border-2 border-border bg-card p-6 transition-all hover:border-orange-400 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2"
            >
              <div className="flex size-14 items-center justify-center rounded-full bg-orange-100">
                <BookOpen className="size-7 text-orange-600" />
              </div>
              <h3 className="text-lg font-semibold text-ink">
                {t("flowSelection.storyMode")}
              </h3>
              <p className="text-sm text-muted-foreground">
                {t("flowSelection.storyModeDesc")}
              </p>
            </button>
          </div>
        </div>
      )}

      {/* Image upload flow */}
      {analysisState === "idle" && flow === "image" && (
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
          {currentUpload && (
            <Button
              onClick={handleAnalyze}
              disabled={analysisState !== "idle"}
              className="w-full"
              size="lg"
            >
              <Sparkles className="mr-2 size-5" />
              {t("analysis.analyzeButton")}
            </Button>
          )}
        </div>
      )}

      {/* Audio recording flow */}
      {analysisState === "idle" && flow === "audio" && (
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
          {currentUpload && (
            <Button
              onClick={handleAnalyze}
              disabled={analysisState !== "idle"}
              className="w-full"
              size="lg"
            >
              <Sparkles className="mr-2 size-5" />
              {t("analysis.analyzeButton")}
            </Button>
          )}
        </div>
      )}

      {/* Story prompting flow */}
      {analysisState === "idle" && flow === "story" && (
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
          <StoryPrompt
            images={storyImages}
            onAnalysisComplete={handleStoryAnalysisComplete}
            onAnalysisStart={handleStoryAnalysisStart}
            onError={handleStoryError}
          />
        </div>
      )}
    </div>
  );
}
