"use client";

import React, { useState, useCallback, useMemo, useEffect } from "react";
import { useTranslations } from "next-intl";
import { ImageIcon, Mic, Sparkles, BookOpen, Users, History, Clock, ArrowRight, ChevronLeft, ChevronRight, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { UploadZone } from "@/components/upload/UploadZone";
import { AudioRecorder } from "@/components/upload/AudioRecorder";
import { AnalysisResults } from "@/components/discovery/AnalysisResults";
import { AnalysisLoading } from "@/components/discovery/AnalysisLoading";
import { AnalysisError } from "@/components/discovery/AnalysisError";
import { StoryPrompt } from "@/components/discovery/StoryPrompt";
import { DiscoverIdleScene } from "@/components/discovery/DiscoverIdleScene";
import {
  GuestProfileModal,
  readGuestProfile,
  GUEST_NAME_KEY,
  GUEST_DOB_KEY,
  type GuestProfile,
} from "@/components/discovery/GuestProfileModal";
import {
  readGuestHistory,
  addToGuestHistory,
  clearGuestHistory,
  getGuestAnalysisCount,
  GUEST_ANALYSIS_LIMIT,
  type GuestHistoryItem,
} from "@/lib/guest-analysis-history";
import { getRandomStoryPrompts } from "@/lib/story-prompts";
import { useRouter, Link } from "@/i18n/navigation";
import { useChildId } from "@/hooks/use-child-id";
import { KidPageShell } from "@/components/layout/KidPageShell";
import type { UploadResultData } from "@/types/upload";
import type { AnalysisOutput } from "@/lib/ai/schemas";
import type { Talent } from "@/lib/ai/schemas";

interface DiscoveryItem {
  id: string;
  type: string;
  fileUrl: string | null;
  talents: Talent[];
  createdAt: string;
}

type DiscoveryFlow = "image" | "audio" | "story";
type AnalysisState = "idle" | "analyzing" | "done" | "error";
type ErrorType = "ai_failure" | "timeout" | "network" | "content_blocked" | "guest_limit_reached";
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
  const [childName, setChildName] = useState<string | null>(null);
  const [sessionChildId, setSessionChildId] = useState<string | null>(null);
  useChildId(authState, sessionChildId);
  const [flow, setFlow] = useState<DiscoveryFlow | null>(null);
  const [analysisState, setAnalysisState] = useState<AnalysisState>("idle");
  const [analysisResults, setAnalysisResults] = useState<AnalysisOutput | null>(null);
  const [errorType, setErrorType] = useState<ErrorType>("ai_failure");
  const [currentUpload, setCurrentUpload] = useState<UploadResultData | null>(null);

  const [historyItems, setHistoryItems] = useState<DiscoveryItem[]>([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyLoading, setHistoryLoading] = useState(false);
  const HISTORY_LIMIT = 5;

  const [guestProfile, setGuestProfile] = useState<GuestProfile | null>(null);
  const [guestHistory, setGuestHistory] = useState<GuestHistoryItem[]>([]);
  const [guestModalOpen, setGuestModalOpen] = useState(false);
  const [guestResetModalOpen, setGuestResetModalOpen] = useState(false);
  const [pendingAnalyze, setPendingAnalyze] = useState<(() => void) | null>(null);
  const guestStoryGateRef = React.useRef<((allowed: boolean) => void) | null>(null);

  const storyImages = useMemo(() => getRandomStoryPrompts(3), []);

  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch("/api/auth/session");
        const data = await res.json();
        if (!data.authenticated) {
          setAuthState("unauthenticated");
          setGuestProfile(readGuestProfile());
          setGuestHistory(readGuestHistory());
        } else if (data.type === "user") {
          setAuthState("parent");
        } else {
          setAuthState("child");
          setChildName(data.childName ?? null);
          setSessionChildId(data.childId ?? null);
        }
      } catch {
        setAuthState("unauthenticated");
        setGuestProfile(readGuestProfile());
        setGuestHistory(readGuestHistory());
      }
    }
    checkAuth();
  }, []);

  const fetchHistory = useCallback(async (page: number) => {
    setHistoryLoading(true);
    try {
      const res = await fetch(`/api/discovery/history?page=${page}&limit=${HISTORY_LIMIT}`);
      if (!res.ok) return;
      const data = await res.json();
      setHistoryItems(data.discoveries ?? []);
      setHistoryTotal(data.total ?? 0);
      setHistoryPage(page);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authState === "child") fetchHistory(1);
  }, [authState, fetchHistory]);

  const runAnalysis = useCallback(async (upload: UploadResultData) => {
    setAnalysisState("analyzing");
    setAnalysisResults(null);

    const guestDob = authState === "unauthenticated"
      ? readGuestProfile()?.dob ?? null
      : null;

    try {
      const response = await fetch("/api/discovery/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          artifactUrl: upload.url,
          artifactType: upload.category,
          ...(guestDob ? { guestDob } : {}),
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        if (response.status === 504 || data.error === "timeout") {
          setErrorType("timeout");
        } else if (response.status === 403 || data.error === "content_blocked") {
          setErrorType("content_blocked");
        } else if (response.status === 429 || data.error === "guest_limit_reached") {
          setErrorType("guest_limit_reached");
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

      // Guest: persist to localStorage history
      if (authState === "unauthenticated") {
        const artifactType = upload.category === "audio" ? "audio" : "artifact";
        addToGuestHistory({ type: artifactType as GuestHistoryItem["type"], fileUrl: upload.url, talents: data.talents });
        setGuestHistory(readGuestHistory());
      }

      setAnalysisResults(data);
      setAnalysisState("done");
    } catch {
      setErrorType("network");
      setAnalysisState("error");
    }
  }, [router, authState]);

  const handleUploadComplete = useCallback((result: UploadResultData) => {
    setCurrentUpload(result);
  }, []);

  const ensureGuestProfile = useCallback(
    (run: () => void) => {
      if (authState !== "unauthenticated") {
        run();
        return;
      }
      // Client-side guard: refuse if local history already at limit
      if (getGuestAnalysisCount() >= GUEST_ANALYSIS_LIMIT) {
        setErrorType("guest_limit_reached");
        setAnalysisState("error");
        return;
      }
      const existing = readGuestProfile();
      if (existing) {
        setGuestProfile(existing);
        run();
        return;
      }
      setPendingAnalyze(() => run);
      setGuestModalOpen(true);
    },
    [authState],
  );

  const handleAnalyze = useCallback(() => {
    if (!currentUpload) return;
    const upload = currentUpload;
    ensureGuestProfile(() => {
      try {
        sessionStorage.removeItem("katalis-upload-discover");
      } catch {
        // Ignore
      }
      runAnalysis(upload);
    });
  }, [currentUpload, ensureGuestProfile, runAnalysis]);

  const handleStoryBeforeSubmit = useCallback((): Promise<boolean> => {
    if (authState !== "unauthenticated") return Promise.resolve(true);
    // Client-side guard: refuse if local history already at limit
    if (getGuestAnalysisCount() >= GUEST_ANALYSIS_LIMIT) {
      setErrorType("guest_limit_reached");
      setAnalysisState("error");
      return Promise.resolve(false);
    }
    if (readGuestProfile()) return Promise.resolve(true);
    return new Promise<boolean>((resolve) => {
      guestStoryGateRef.current = resolve;
      setGuestModalOpen(true);
    });
  }, [authState]);

  const handleGuestModalSubmit = useCallback(
    (profile: GuestProfile) => {
      setGuestProfile(profile);
      setGuestModalOpen(false);
      if (guestStoryGateRef.current) {
        guestStoryGateRef.current(true);
        guestStoryGateRef.current = null;
      }
      if (pendingAnalyze) {
        const run = pendingAnalyze;
        setPendingAnalyze(null);
        run();
      }
    },
    [pendingAnalyze],
  );

  const handleGuestModalCancel = useCallback(() => {
    setGuestModalOpen(false);
    if (guestStoryGateRef.current) {
      guestStoryGateRef.current(false);
      guestStoryGateRef.current = null;
    }
    setPendingAnalyze(null);
  }, []);

  const handleResetGuest = useCallback(() => {
    try {
      sessionStorage.removeItem(GUEST_NAME_KEY);
      sessionStorage.removeItem(GUEST_DOB_KEY);
      sessionStorage.removeItem("guest_talents");
      sessionStorage.removeItem("guest_quest");
    } catch {
      // Ignore
    }
    clearGuestHistory();
    setGuestProfile(null);
    setGuestHistory([]);
    setGuestResetModalOpen(false);
    setFlow(null);
    setAnalysisState("idle");
    setAnalysisResults(null);
    setCurrentUpload(null);
  }, []);

  const resetDiscoveryUpload = useCallback(() => {
    setCurrentUpload(null);
    setAnalysisState("idle");
    setAnalysisResults(null);
    try {
      sessionStorage.removeItem("katalis-upload-discover");
    } catch {
      // Ignore
    }
  }, []);

  const handleRetry = useCallback(() => {
    if (currentUpload) runAnalysis(currentUpload);
    else setAnalysisState("idle");
  }, [currentUpload, runAnalysis]);

  const handleSwitchFlow = useCallback((next: DiscoveryFlow | null) => {
    setFlow(next);
    setAnalysisState("idle");
    setAnalysisResults(null);
    setCurrentUpload(null);
    try {
      sessionStorage.removeItem("katalis-upload-discover");
    } catch {
      // Ignore
    }
  }, []);

  const handleNewDiscovery = useCallback(() => {
    setFlow(null);
    setAnalysisState("idle");
    setAnalysisResults(null);
    setCurrentUpload(null);
    try {
      sessionStorage.removeItem("katalis-upload-discover");
    } catch {
      // Ignore
    }
  }, []);

  const handleStoryAnalysisComplete = useCallback(
    (results: AnalysisOutput) => {
      saveDiscoveryResults("story", results.talents).then((discoveryId) => {
        if (discoveryId) {
          router.push(`/discover/results/${discoveryId}`);
          return;
        }
        // Guest: persist story result to localStorage history
        if (authState === "unauthenticated") {
          addToGuestHistory({ type: "story", fileUrl: null, talents: results.talents });
          setGuestHistory(readGuestHistory());
        }
        setAnalysisResults(results);
        setAnalysisState("done");
      });
    },
    [router, authState],
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

  const displayName =
    (authState === "child" && childName) ||
    (authState === "unauthenticated" && guestProfile?.name) ||
    null;
  const personalTitle = displayName ? `${t("title")}, ${displayName}!` : t("title");

  return (
    <KidPageShell
      kicker={t("kicker")}
      title={personalTitle}
      subtitle={t("subtitle")}
      actions={
        authState === "child" ? (
          <Link href="/discover/history">
            <Button
              size="sm"
              variant="outline"
              className="rounded-full border-2 border-black bg-white font-black text-black shadow-[3px_3px_0_#000] hover:bg-white hover:brightness-95 active:shadow-[1px_1px_0_#000]"
            >
              <History className="mr-1.5 size-4" />
              {t("results.viewHistory")}
            </Button>
          </Link>
        ) : authState === "unauthenticated" && guestProfile ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setGuestResetModalOpen(true)}
            className="rounded-full border-2 border-black bg-white font-black text-black shadow-[3px_3px_0_#000] hover:bg-white hover:brightness-95 active:shadow-[1px_1px_0_#000]"
          >
            {t("notYou", { name: guestProfile.name })}
          </Button>
        ) : null
      }
    >
      <div className="flex flex-col lg:flex-row lg:items-start lg:gap-10">
      {/* Left column: persistent flow tabs */}
      <div className="mb-6 shrink-0 lg:mb-0 lg:w-4/12">
        <nav className="flex gap-2 lg:flex-col" aria-label={t("flowSelection.title")}>
          {flowTabs.map((tab) => {
            const isActive = flow === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleSwitchFlow(tab.id)}
                className={cn(
                  "flex flex-1 items-center gap-3 rounded-xl border-2 border-black px-4 py-3 text-left text-sm font-black tracking-tight transition-all",
                  isActive
                    ? "bg-white text-black shadow-[3px_3px_0_#000]"
                    : "bg-white/60 text-black/60 hover:bg-white hover:text-black hover:shadow-[3px_3px_0_#000]",
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
          <AnalysisError
            errorType={errorType}
            onRetry={handleRetry}
            onResetUpload={flow === "image" ? resetDiscoveryUpload : undefined}
          />
        )}

        {analysisState === "idle" && flow === null && (
          <DiscoverIdleScene />
        )}

        {analysisState === "idle" && flow === "image" && (
          <div className="flex flex-col gap-6">
            <UploadZone
              onUploadComplete={handleUploadComplete}
              storageKey="katalis-upload-discover"
            />
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
            beforeSubmit={authState === "unauthenticated" ? handleStoryBeforeSubmit : undefined}
            guestDob={guestProfile?.dob ?? null}
          />
        )}
      </div>

      </div>{/* end two-column content row */}

      <GuestProfileModal
        open={guestModalOpen}
        onCancel={handleGuestModalCancel}
        onSubmit={handleGuestModalSubmit}
      />

      {/* Guest reset confirmation modal */}
      <Dialog open={guestResetModalOpen} onOpenChange={setGuestResetModalOpen}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>{t("resetGuest.title")}</DialogTitle>
            <DialogDescription>{t("resetGuest.warning")}</DialogDescription>
          </DialogHeader>
          <div className="flex items-start gap-2 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <span>{t("resetGuest.warning")}</span>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setGuestResetModalOpen(false)}
            >
              {t("resetGuest.cancel", { name: guestProfile?.name ?? "" })}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleResetGuest}
            >
              {t("resetGuest.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Discovery history — guest */}
      {authState === "unauthenticated" && guestHistory.length > 0 && (
        <div className="border-t border-border px-4 py-8">
          <div className="mx-auto max-w-6xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-ink">{t("guestHistory.title")}</h2>
              <span className="text-sm text-muted-foreground">
                {t("guestHistory.count", { count: guestHistory.length, max: GUEST_ANALYSIS_LIMIT })}
              </span>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {guestHistory.map((item) => {
                const typeLabel =
                  item.type === "artifact" ? t("history.artifact") :
                  item.type === "story" ? t("history.story") :
                  t("history.audio");
                const TypeIcon =
                  item.type === "artifact" ? ImageIcon :
                  item.type === "story" ? BookOpen :
                  Mic;
                return (
                  <div
                    key={item.id}
                    className="flex items-start gap-3 rounded-xl border border-border bg-card p-4"
                  >
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber-50">
                      {React.createElement(TypeIcon, { className: "size-4 text-amber-600" })}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-ink">{typeLabel}</p>
                      <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Clock className="size-3" />
                        <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {item.talents.slice(0, 2).map((talent, i) => (
                          <span key={i} className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                            {talent.name}
                          </span>
                        ))}
                        {item.talents.length > 2 && (
                          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                            +{item.talents.length - 2}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {guestHistory.length >= GUEST_ANALYSIS_LIMIT && (
              <div className="mt-4 rounded-lg bg-yellow-sun/10 px-4 py-3 text-center text-sm text-amber-800">
                {t("guestHistory.limitReached")}
                {" "}
                <Link href="/login" className="font-semibold underline underline-offset-2">
                  {t("analysis.loginCta")}
                </Link>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Discovery history — child only */}
      {authState === "child" && (
        <div className="border-t border-border px-4 py-8">
          <div className="mx-auto max-w-6xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-ink">{t("history.title")}</h2>
              {historyTotal > 0 && (
                <span className="text-sm text-muted-foreground">
                  {t("history.totalDiscoveries", { count: historyTotal })}
                </span>
              )}
            </div>

            {historyLoading && (
              <div className="flex justify-center py-8">
                <div className="size-8 animate-spin rounded-full border-2 border-border border-t-amber-500" />
              </div>
            )}

            {!historyLoading && historyItems.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">{t("history.empty")}</p>
            )}

            {!historyLoading && historyItems.length > 0 && (
              <>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {historyItems.map((item) => {
                    const typeLabel =
                      item.type === "artifact" ? t("history.artifact") :
                      item.type === "story" ? t("history.story") :
                      t("history.audio");
                    const TypeIcon =
                      item.type === "artifact" ? ImageIcon :
                      item.type === "story" ? BookOpen :
                      Mic;
                    return (
                      <Link key={item.id} href={`/discover/results/${item.id}`}>
                        <div className="group flex items-start gap-3 rounded-xl border border-border bg-card p-4 transition-shadow hover:border-amber-300 hover:shadow-sm">
                          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber-50">
                            <TypeIcon className="size-4 text-amber-600" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-ink">{typeLabel}</p>
                            <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                              <Clock className="size-3" />
                              <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                            </div>
                            <div className="mt-1.5 flex flex-wrap gap-1">
                              {item.talents.slice(0, 2).map((talent, i) => (
                                <span key={i} className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                                  {talent.name}
                                </span>
                              ))}
                              {item.talents.length > 2 && (
                                <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                                  +{item.talents.length - 2}
                                </span>
                              )}
                            </div>
                          </div>
                          <ArrowRight className="mt-1 size-4 shrink-0 text-border transition-transform group-hover:translate-x-1" />
                        </div>
                      </Link>
                    );
                  })}
                </div>

                {/* Pagination */}
                {historyTotal > HISTORY_LIMIT && (
                  <div className="mt-5 flex items-center justify-center gap-3">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={historyPage === 1}
                      onClick={() => fetchHistory(historyPage - 1)}
                    >
                      <ChevronLeft className="size-4" />
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      {historyPage} / {Math.ceil(historyTotal / HISTORY_LIMIT)}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={historyPage >= Math.ceil(historyTotal / HISTORY_LIMIT)}
                      onClick={() => fetchHistory(historyPage + 1)}
                    >
                      <ChevronRight className="size-4" />
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </KidPageShell>
  );
}
