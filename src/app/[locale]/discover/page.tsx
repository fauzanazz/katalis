"use client";

import React, { useState, useCallback, useMemo, useEffect } from "react";
import { useTranslations } from "next-intl";
import { ImageIcon, Mic, Sparkles, BookOpen, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { UploadZone } from "@/components/upload/UploadZone";
import { AudioRecorder } from "@/components/upload/AudioRecorder";
import { AnalysisResults } from "@/components/discovery/AnalysisResults";
import { AnalysisLoading } from "@/components/discovery/AnalysisLoading";
import { AnalysisError } from "@/components/discovery/AnalysisError";
import { StoryPrompt } from "@/components/discovery/StoryPrompt";
import { DiscoverIdleScene } from "@/components/discovery/DiscoverIdleScene";
import Image from "next/image";
import { getRandomStoryPrompts } from "@/lib/story-prompts";
import { useRouter, Link } from "@/i18n/navigation";
import type { UploadResultData } from "@/types/upload";
import type { AnalysisOutput } from "@/lib/ai/schemas";

type DiscoveryFlow = "image" | "audio" | "story";
type AnalysisState = "idle" | "analyzing" | "done" | "error";
type ErrorType = "ai_failure" | "timeout" | "network" | "content_blocked";
type AuthState = "loading" | "child" | "parent" | "unauthenticated";

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
  const [flow, setFlow] = useState<DiscoveryFlow | null>(null);
  const [analysisState, setAnalysisState] = useState<AnalysisState>("idle");
  const [analysisResults, setAnalysisResults] = useState<AnalysisOutput | null>(null);
  const [errorType, setErrorType] = useState<ErrorType>("ai_failure");
  const [currentUpload, setCurrentUpload] = useState<UploadResultData | null>(null);

  const storyImages = useMemo(() => getRandomStoryPrompts(3), []);

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

      const discoveryId = await saveDiscoveryResults("artifact", data.talents, upload.url);
      if (discoveryId) {
        router.push(`/discover/results/${discoveryId}`);
        return;
      }

      setAnalysisResults(data);
      setAnalysisState("done");
    } catch {
      setErrorType("network");
      setAnalysisState("error");
    }
  }, [router]);

  const handleUploadComplete = useCallback((result: UploadResultData) => {
    setCurrentUpload(result);
  }, []);

  const handleAnalyze = useCallback(() => {
    if (currentUpload) runAnalysis(currentUpload);
  }, [currentUpload, runAnalysis]);

  const handleRetry = useCallback(() => {
    if (currentUpload) runAnalysis(currentUpload);
    else setAnalysisState("idle");
  }, [currentUpload, runAnalysis]);

  const handleSwitchFlow = useCallback((next: DiscoveryFlow | null) => {
    setFlow(next);
    setAnalysisState("idle");
    setAnalysisResults(null);
    setCurrentUpload(null);
  }, []);

  const handleNewDiscovery = useCallback(() => {
    setFlow(null);
    setAnalysisState("idle");
    setAnalysisResults(null);
    setCurrentUpload(null);
  }, []);

  const handleStoryAnalysisComplete = useCallback(
    (results: AnalysisOutput) => {
      saveDiscoveryResults("story", results.talents).then((discoveryId) => {
        if (discoveryId) {
          router.push(`/discover/results/${discoveryId}`);
          return;
        }
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

  const handleStoryError = useCallback((type: ErrorType) => {
    setErrorType(type);
    setAnalysisState("error");
  }, []);

  const handleCreateGuestQuest = useCallback(() => {
    if (analysisResults) {
      sessionStorage.setItem("guest_talents", JSON.stringify(analysisResults.talents));
      router.push("/quest/new");
    }
  }, [analysisResults, router]);

  if (authState === "loading") {
    return (
      <div className="mx-auto flex min-h-[50vh] w-full max-w-2xl items-center justify-center px-4">
        <div className="flex items-end gap-2" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="size-3 rounded-full bg-yellow-sun-deep animate-bounce"
              style={{ animationDelay: `${i * 130}ms` }}
            />
          ))}
        </div>
      </div>
    );
  }

  if (authState === "parent") {
    return (
      <div className="mx-auto w-full max-w-md px-4 py-12 sm:py-16">
        <div className="flex flex-col items-center gap-6 text-center">
          <div className="flex size-16 items-center justify-center rounded-full bg-yellow-sun/20">
            <Users className="size-8 text-yellow-sun-deep" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-ink">
              {t("parentAuth.title")}
            </h1>
            <p className="mt-2 text-muted-foreground">{t("parentAuth.message")}</p>
          </div>
          <Button onClick={() => router.push("/parent")} size="lg">
            {t("parentAuth.goToParent")}
          </Button>
          <p className="text-sm text-muted-foreground">{t("parentAuth.hint")}</p>
        </div>
      </div>
    );
  }

  const flowTabs: { id: DiscoveryFlow; icon: React.ReactNode; label: string; activeColor: string; activeBg: string }[] = [
    {
      id: "story",
      icon: <BookOpen className="size-5 shrink-0" strokeWidth={1.5} />,
      label: t("flowSelection.storyMode"),
      activeColor: "text-blue-ocean-deep",
      activeBg: "bg-[#eef4ff] ring-1 ring-blue-ocean/20",
    },
    {
      id: "image",
      icon: <ImageIcon className="size-5 shrink-0" strokeWidth={1.5} />,
      label: t("flowSelection.uploadArtifact"),
      activeColor: "text-yellow-sun-deep",
      activeBg: "bg-[#fff9e6] ring-1 ring-yellow-sun/30",
    },
    {
      id: "audio",
      icon: <Mic className="size-5 shrink-0" strokeWidth={1.5} />,
      label: t("flowSelection.recordAudio"),
      activeColor: "text-mint-cloud",
      activeBg: "bg-[#f0f9f7] ring-1 ring-mint-cloud/30",
    },
  ];

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col">
      {/* Two-column content row */}
      <div className="flex flex-col px-4 py-10 lg:min-h-[calc(100svh-20rem)] lg:flex-row lg:items-center lg:gap-16 lg:py-8">

      {/* Left column: title + persistent flow tabs */}
      <div className="mb-8 shrink-0 lg:mb-0 lg:w-5/12">
        <div className="text-center lg:text-left">
          <h1 className="type-h1 mb-3">{t("title")}</h1>
          <p className="type-lede mx-auto max-w-md lg:mx-0">{t("subtitle")}</p>
        </div>

        {/* Flow tab nav — horizontal on mobile, vertical on desktop */}
        <nav className="mt-8 flex gap-2 lg:flex-col" aria-label={t("flowSelection.title")}>
          {flowTabs.map((tab) => {
            const isActive = flow === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleSwitchFlow(tab.id)}
                className={cn(
                  "flex flex-1 items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-medium transition-all duration-150",
                  isActive
                    ? `${tab.activeBg} ${tab.activeColor}`
                    : "text-muted-foreground hover:bg-muted hover:text-ink",
                )}
              >
                {tab.icon}
                <span className="hidden sm:block lg:block">{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Right column: active flow content */}
      <div className="min-w-0 flex-1">
        {analysisState === "done" && analysisResults && (
          <div className="flex flex-col gap-6">
            <AnalysisResults results={analysisResults} />
            {authState === "unauthenticated" && (
              <div className="rounded-2xl bg-yellow-sun/10 px-6 py-8 text-center">
                <p className="mb-4 font-bold text-ink">{t("analysis.createQuestHint")}</p>
                <Button
                  onClick={handleCreateGuestQuest}
                  size="lg"
                  className="mb-4 w-full bg-yellow-sun-deep font-bold text-white hover:bg-yellow-sun sm:w-auto"
                >
                  <Sparkles className="mr-2 size-5" />
                  {t("analysis.createQuestCta")}
                </Button>
                <p className="text-sm text-muted-foreground">
                  <Link href="/login" className="underline underline-offset-2">
                    {t("analysis.loginCta")}
                  </Link>
                </p>
              </div>
            )}
            <div className="flex justify-center">
              <Button onClick={handleNewDiscovery} variant="outline">
                {t("analysis.discoverAgain")}
              </Button>
            </div>
          </div>
        )}

        {analysisState === "analyzing" && <AnalysisLoading />}

        {analysisState === "error" && (
          <AnalysisError errorType={errorType} onRetry={handleRetry} />
        )}

        {analysisState === "idle" && flow === null && (
          <DiscoverIdleScene />
        )}

        {analysisState === "idle" && flow === "image" && (
          <div className="flex flex-col gap-6">
            <UploadZone onUploadComplete={handleUploadComplete} />
            {currentUpload && (
              <Button
                onClick={handleAnalyze}
                size="lg"
                className="w-full bg-yellow-sun-deep font-bold text-white hover:bg-yellow-sun"
              >
                <Sparkles className="mr-2 size-5" />
                {t("analysis.analyzeButton")}
              </Button>
            )}
          </div>
        )}

        {analysisState === "idle" && flow === "audio" && (
          <div className="flex flex-col gap-6">
            <AudioRecorder onUploadComplete={handleUploadComplete} />
            {currentUpload && (
              <Button
                onClick={handleAnalyze}
                size="lg"
                className="w-full bg-yellow-sun-deep font-bold text-white hover:bg-yellow-sun"
              >
                <Sparkles className="mr-2 size-5" />
                {t("analysis.analyzeButton")}
              </Button>
            )}
          </div>
        )}

        {analysisState === "idle" && flow === "story" && (
          <StoryPrompt
            images={storyImages}
            onAnalysisComplete={handleStoryAnalysisComplete}
            onAnalysisStart={handleStoryAnalysisStart}
            onError={handleStoryError}
          />
        )}
      </div>

      </div>{/* end two-column content row */}

      {/* Garden strip — in-flow below content, always visible on desktop */}
      <div className="pointer-events-none hidden overflow-hidden lg:block" aria-hidden="true">
        <Image
          src="/images/discover/garden-strip.webp"
          alt=""
          width={1792}
          height={1024}
          className="h-64 w-full object-cover object-bottom"
        />
      </div>
    </div>
  );
}
