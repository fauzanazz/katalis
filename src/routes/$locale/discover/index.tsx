import React, { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { createFileRoute } from "@tanstack/react-router";
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
import { UploadZone } from "@/components/start/upload/UploadZone";
import { AudioRecorder } from "@/components/start/upload/AudioRecorder";
import { AnalysisResults } from "@/components/start/discovery/AnalysisResults";
import { AnalysisLoading } from "@/components/start/discovery/AnalysisLoading";
import { AnalysisError } from "@/components/start/discovery/AnalysisError";
import { StoryPrompt } from "@/components/start/discovery/StoryPrompt";
import { DiscoverIdleScene } from "@/components/start/discovery/DiscoverIdleScene";
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
import { LocaleLink, useLocaleRouter } from "@/i18n/start-navigation";
import { useChildId } from "@/hooks/use-child-id";
import { KidPageShell } from "@/components/layout/KidPageShell";
import { m } from "@/paraglide/messages";
import {
  analyzeArtifactFn,
  transcribeAudioFn,
  saveDiscoveryFn,
  getDiscoveryHistoryFn,
} from "@/lib/server/discovery";
import { getAuthSessionFn } from "@/lib/server/auth";
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

type DiscoveryFlow = "artwork" | "story";
type AnalysisState = "idle" | "analyzing" | "done" | "error";
type ErrorType = "ai_failure" | "timeout" | "network" | "content_blocked" | "guest_limit_reached";
type AuthState = "loading" | "child" | "parent" | "unauthenticated";

export const Route = createFileRoute("/$locale/discover/")({
  loader: async () => {
    try {
      const session = await getAuthSessionFn();
      return { session };
    } catch {
      return { session: { authenticated: false as const } };
    }
  },
  component: DiscoverPage,
});

async function saveDiscoveryResults(
  type: "artifact" | "story",
  talents: AnalysisOutput["talents"],
  fileUrl?: string,
): Promise<string | null> {
  try {
    const result = await saveDiscoveryFn({ data: { type, fileUrl, talents } });
    if (!result.ok) return null;
    return result.id ?? null;
  } catch {
    return null;
  }
}

function DiscoverPage() {
  const { session } = Route.useLoaderData();
  const router = useLocaleRouter();

  const [authState, setAuthState] = useState<AuthState>("loading");
  const [childName, setChildName] = useState<string | null>(null);
  const [sessionChildId, setSessionChildId] = useState<string | null>(null);
  useChildId(authState, sessionChildId);
  const [flow, setFlow] = useState<DiscoveryFlow | null>(null);
  const [analysisState, setAnalysisState] = useState<AnalysisState>("idle");
  const [analysisResults, setAnalysisResults] = useState<AnalysisOutput | null>(null);
  const [errorType, setErrorType] = useState<ErrorType>("ai_failure");
  const [currentUpload, setCurrentUpload] = useState<UploadResultData | null>(null);

  const [artworkStoryMode, setArtworkStoryMode] = useState<"text" | "audio">("text");
  const [artworkStoryText, setArtworkStoryText] = useState("");
  const [artworkStoryAudio, setArtworkStoryAudio] = useState<UploadResultData | null>(null);
  const [isTranscribingAudio, setIsTranscribingAudio] = useState(false);

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
  const guestStoryGateRef = useRef<((allowed: boolean) => void) | null>(null);

  const storyImages = useMemo(() => getRandomStoryPrompts(3), []);

  // Resolve auth state from loader data, with guest localStorage fallback
  useEffect(() => {
    if (!session.authenticated) {
      setAuthState("unauthenticated");
      setGuestProfile(readGuestProfile());
      setGuestHistory(readGuestHistory());
    } else if (session.mode === "parent") {
      setAuthState("parent");
    } else {
      setAuthState("child");
      setChildName((session as { childName?: string | null }).childName ?? null);
      setSessionChildId((session as { childId?: string | null }).childId ?? null);
    }
  }, [session]);

  const fetchHistory = useCallback(async (page: number) => {
    setHistoryLoading(true);
    try {
      const result = await getDiscoveryHistoryFn({ data: { page, limit: HISTORY_LIMIT } });
      if (!result.ok) return;
      setHistoryItems(result.discoveries ?? []);
      setHistoryTotal(result.total ?? 0);
      setHistoryPage(page);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authState === "child") fetchHistory(1);
  }, [authState, fetchHistory]);

  const runAnalysis = useCallback(async (upload: UploadResultData, resolvedStoryContext?: string) => {
    setAnalysisState("analyzing");
    setAnalysisResults(null);

    const guestDob = authState === "unauthenticated"
      ? readGuestProfile()?.dob ?? null
      : null;

    try {
      const result = await analyzeArtifactFn({
        data: {
          artifactUrl: upload.url,
          artifactType: upload.category,
          ...(guestDob ? { guestDob } : {}),
          ...(resolvedStoryContext ? { storyContext: resolvedStoryContext } : {}),
        },
      });

      if (!result.ok) {
        const errorCode = result.error;
        if (errorCode === "timeout") {
          setErrorType("timeout");
        } else if (errorCode === "content_blocked") {
          setErrorType("content_blocked");
        } else if (errorCode === "guest_limit_reached") {
          setErrorType("guest_limit_reached");
        } else {
          setErrorType("ai_failure");
        }
        setAnalysisState("error");
        return;
      }

      // Content blocked returned as ok() with blocked flag
      if ("blocked" in result && result.blocked) {
        setErrorType("content_blocked");
        setAnalysisState("error");
        return;
      }

      const data = result as unknown as AnalysisOutput;

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

  const handleAnalyze = useCallback(async () => {
    if (!currentUpload) return;
    const upload = currentUpload;

    let resolvedStoryContext: string | undefined;
    if (artworkStoryMode === "text" && artworkStoryText.trim()) {
      resolvedStoryContext = artworkStoryText.trim();
    } else if (artworkStoryMode === "audio" && artworkStoryAudio) {
      setIsTranscribingAudio(true);
      try {
        const res = await transcribeAudioFn({ data: { audioUrl: artworkStoryAudio.url } });
        if (res.ok) {
          resolvedStoryContext = (res as { ok: true; transcript?: string }).transcript || undefined;
        }
      } catch {
        // Non-fatal — proceed without story context
      } finally {
        setIsTranscribingAudio(false);
      }
    }

    ensureGuestProfile(() => {
      try {
        sessionStorage.removeItem("katalis-upload-discover");
      } catch {
        // Ignore
      }
      runAnalysis(upload, resolvedStoryContext);
    });
  }, [currentUpload, ensureGuestProfile, runAnalysis, artworkStoryMode, artworkStoryText, artworkStoryAudio]);

  const handleStoryBeforeSubmit = useCallback((): Promise<boolean> => {
    if (authState !== "unauthenticated") return Promise.resolve(true);
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
    setArtworkStoryMode("text");
    setArtworkStoryText("");
    setArtworkStoryAudio(null);
    setIsTranscribingAudio(false);
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
    setArtworkStoryMode("text");
    setArtworkStoryText("");
    setArtworkStoryAudio(null);
    setIsTranscribingAudio(false);
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
    setArtworkStoryMode("text");
    setArtworkStoryText("");
    setArtworkStoryAudio(null);
    setIsTranscribingAudio(false);
  }, []);

  const handleStoryAnalysisComplete = useCallback(
    (results: AnalysisOutput) => {
      saveDiscoveryResults("story", results.talents).then((discoveryId) => {
        if (discoveryId) {
          router.push(`/discover/results/${discoveryId}`);
          return;
        }
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

  const handleViewGuestHistoryItem = useCallback((item: GuestHistoryItem) => {
    setAnalysisResults({ talents: item.talents });
    setAnalysisState("done");
    setFlow(null);
    setCurrentUpload(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
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
              {m.discover_parentAuth_title()}
            </h1>
            <p className="mt-2 text-muted-foreground">{m.discover_parentAuth_message()}</p>
          </div>
          <Button onClick={() => router.push("/parent")} size="lg">
            {m.discover_parentAuth_goToParent()}
          </Button>
          <p className="text-sm text-muted-foreground">{m.discover_parentAuth_hint()}</p>
        </div>
      </div>
    );
  }

  const flowTabs: { id: DiscoveryFlow; icon: React.ReactNode; label: string }[] = [
    {
      id: "artwork",
      icon: React.createElement(ImageIcon, { className: "size-5 shrink-0", strokeWidth: 1.5 }),
      label: m.discover_flowSelection_uploadArtifact(),
    },
    {
      id: "story",
      icon: React.createElement(BookOpen, { className: "size-5 shrink-0", strokeWidth: 1.5 }),
      label: m.discover_flowSelection_storyMode(),
    },
  ];

  const displayName =
    (authState === "child" && childName) ||
    (authState === "unauthenticated" && guestProfile?.name) ||
    null;
  const personalTitle = displayName
    ? `${m.discover_title()}, ${displayName}!`
    : m.discover_title();

  return (
    <KidPageShell
      kicker={m.discover_kicker()}
      title={personalTitle}
      subtitle={m.discover_subtitle()}
      actions={
        authState === "child" ? (
          <LocaleLink href="/discover/history">
            <Button
              size="sm"
              variant="outline"
              className="rounded-full border-2 border-black bg-white font-black text-black shadow-[3px_3px_0_#000] hover:bg-white hover:brightness-95 active:shadow-[1px_1px_0_#000]"
            >
              {React.createElement(History, { className: "mr-1.5 size-4" })}
              {m.discover_results_viewHistory()}
            </Button>
          </LocaleLink>
        ) : authState === "unauthenticated" && guestProfile ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setGuestResetModalOpen(true)}
            className="rounded-full border-2 border-black bg-white font-black text-black shadow-[3px_3px_0_#000] hover:bg-white hover:brightness-95 active:shadow-[1px_1px_0_#000]"
          >
            {m.discover_notYou({ name: guestProfile.name })}
          </Button>
        ) : null
      }
    >
      <div className="flex flex-col lg:flex-row lg:items-start lg:gap-10">
        {/* Left column: persistent flow tabs */}
        <div className="mb-6 shrink-0 lg:mb-0 lg:w-4/12">
          <nav className="flex gap-2 lg:flex-col" aria-label={m.discover_flowSelection_title()}>
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
                  <span className="block">{tab.label}</span>
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
                  <p className="mb-4 font-bold text-ink">{m.discover_analysis_createQuestHint()}</p>
                  <Button
                    onClick={handleCreateGuestQuest}
                    size="lg"
                    className="mb-4 w-full bg-yellow-sun-deep font-bold text-white hover:bg-yellow-sun sm:w-auto"
                  >
                    {React.createElement(Sparkles, { className: "mr-2 size-5" })}
                    {m.discover_analysis_createQuestCta()}
                  </Button>
                  <p className="text-sm text-muted-foreground">
                    <LocaleLink href="/register" className="underline underline-offset-2">
                      {m.discover_analysis_loginCta()}
                    </LocaleLink>
                  </p>
                </div>
              )}
              <div className="flex justify-center">
                <Button onClick={handleNewDiscovery} variant="outline">
                  {m.discover_analysis_discoverAgain()}
                </Button>
              </div>
            </div>
          )}

          {analysisState === "analyzing" && <AnalysisLoading />}

          {analysisState === "error" && (
            <AnalysisError
              errorType={errorType}
              onRetry={handleRetry}
              onResetUpload={flow === "artwork" ? resetDiscoveryUpload : undefined}
            />
          )}

          {analysisState === "idle" && flow === null && (
            <DiscoverIdleScene />
          )}

          {analysisState === "idle" && flow === "artwork" && (
            <div className="flex flex-col gap-6">
              <UploadZone
                onUploadComplete={handleUploadComplete}
                storageKey="katalis-upload-discover"
              />

              {currentUpload && (
                <div className="rounded-xl border-2 border-dashed border-black/10 bg-white/60 px-5 pt-5 pb-3">
                  <p className="mb-3 text-sm font-bold text-ink">
                    {m.discover_flowSelection_artworkStoryOptional()}
                  </p>
                  <div className="mb-4 flex gap-2">
                    <button
                      type="button"
                      onClick={() => setArtworkStoryMode("text")}
                      className={cn(
                        "rounded-full border-2 px-4 py-2.5 text-xs font-bold transition-all min-h-[44px] touch-manipulation",
                        artworkStoryMode === "text"
                          ? "border-black bg-white shadow-[2px_2px_0_#000]"
                          : "border-black/20 bg-white/60 text-black/60",
                      )}
                    >
                      ✏️ {m.discover_flowSelection_artworkStoryWrite()}
                    </button>
                    <button
                      type="button"
                      onClick={() => setArtworkStoryMode("audio")}
                      className={cn(
                        "rounded-full border-2 px-4 py-2.5 text-xs font-bold transition-all min-h-[44px] touch-manipulation",
                        artworkStoryMode === "audio"
                          ? "border-black bg-white shadow-[2px_2px_0_#000]"
                          : "border-black/20 bg-white/60 text-black/60",
                      )}
                    >
                      🎙️ {m.discover_flowSelection_artworkStoryRecord()}
                    </button>
                  </div>
                  {artworkStoryMode === "text" && (
                    <textarea
                      value={artworkStoryText}
                      onChange={(e) => setArtworkStoryText(e.target.value.slice(0, 500))}
                      placeholder={m.discover_flowSelection_artworkStoryPlaceholder()}
                      rows={3}
                      className="w-full resize-none sm:resize-y rounded-lg border-2 border-black/10 bg-white p-3 text-sm focus:border-black/30 focus:outline-none"
                    />
                  )}
                  {artworkStoryMode === "audio" && (
                    <div className="-mx-5">
                      <AudioRecorder onUploadComplete={setArtworkStoryAudio} />
                    </div>
                  )}
                </div>
              )}

              {currentUpload && (
                <Button
                  onClick={handleAnalyze}
                  disabled={isTranscribingAudio}
                  size="lg"
                  className="w-full bg-yellow-sun-deep font-bold text-white hover:bg-yellow-sun disabled:opacity-70"
                >
                  {React.createElement(Sparkles, { className: "mr-2 size-5" })}
                  {isTranscribingAudio ? "Processing audio..." : m.discover_analysis_analyzeButton()}
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
      </div>

      <GuestProfileModal
        open={guestModalOpen}
        onCancel={handleGuestModalCancel}
        onSubmit={handleGuestModalSubmit}
      />

      {/* Guest reset confirmation modal */}
      <Dialog open={guestResetModalOpen} onOpenChange={setGuestResetModalOpen}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>{m.discover_resetGuest_title()}</DialogTitle>
            <DialogDescription>{m.discover_resetGuest_warning()}</DialogDescription>
          </DialogHeader>
          <div className="flex items-start gap-2 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {React.createElement(AlertTriangle, { className: "mt-0.5 size-4 shrink-0" })}
            <span>{m.discover_resetGuest_warning()}</span>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setGuestResetModalOpen(false)}
            >
              {m.discover_resetGuest_cancel({ name: guestProfile?.name ?? "" })}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleResetGuest}
            >
              {m.discover_resetGuest_confirm()}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Discovery history — guest */}
      {authState === "unauthenticated" && guestHistory.length > 0 && (
        <div className="border-t border-border px-4 py-8">
          <div className="mx-auto max-w-6xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-ink">{m.discover_guestHistory_title()}</h2>
              <span className="text-sm text-muted-foreground">
                {m.discover_guestHistory_count({ count: guestHistory.length, max: GUEST_ANALYSIS_LIMIT })}
              </span>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {guestHistory.map((item) => {
                const typeLabel =
                  item.type === "artifact" ? m.discover_history_artifact() :
                  item.type === "story" ? m.discover_history_story() :
                  m.discover_history_audio();
                const TypeIconComponent =
                  item.type === "artifact" ? ImageIcon :
                  item.type === "story" ? BookOpen :
                  Mic;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleViewGuestHistoryItem(item)}
                    className="group flex w-full items-start gap-3 rounded-xl border border-border bg-card p-4 text-left transition-all hover:border-amber-300 hover:shadow-sm active:scale-[0.98]"
                  >
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber-50">
                      {React.createElement(TypeIconComponent, { className: "size-4 text-amber-600" })}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-ink">{typeLabel}</p>
                      <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                        {React.createElement(Clock, { className: "size-3" })}
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
                    {React.createElement(ArrowRight, { className: "mt-1 size-4 shrink-0 text-border transition-transform group-hover:translate-x-1" })}
                  </button>
                );
              })}
            </div>
            {guestHistory.length >= GUEST_ANALYSIS_LIMIT && (
              <div className="mt-4 rounded-lg bg-yellow-sun/10 px-4 py-3 text-center text-sm text-amber-800">
                {m.discover_guestHistory_limitReached()}
                {" "}
                <LocaleLink href="/register" className="font-semibold underline underline-offset-2">
                  {m.discover_analysis_loginCta()}
                </LocaleLink>
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
              <h2 className="text-lg font-bold text-ink">{m.discover_history_title()}</h2>
              {historyTotal > 0 && (
                <span className="text-sm text-muted-foreground">
                  {m.discover_history_totalDiscoveries({ count: historyTotal })}
                </span>
              )}
            </div>

            {historyLoading && (
              <div className="flex justify-center py-8">
                <div className="size-8 animate-spin rounded-full border-2 border-border border-t-amber-500" />
              </div>
            )}

            {!historyLoading && historyItems.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">{m.discover_history_empty()}</p>
            )}

            {!historyLoading && historyItems.length > 0 && (
              <>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {historyItems.map((item) => {
                    const typeLabel =
                      item.type === "artifact" ? m.discover_history_artifact() :
                      item.type === "story" ? m.discover_history_story() :
                      m.discover_history_audio();
                    const TypeIconComponent =
                      item.type === "artifact" ? ImageIcon :
                      item.type === "story" ? BookOpen :
                      Mic;
                    return (
                      <LocaleLink key={item.id} href={`/discover/results/${item.id}`}>
                        <div className="group flex items-start gap-3 rounded-xl border border-border bg-card p-4 transition-shadow hover:border-amber-300 hover:shadow-sm">
                          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber-50">
                            {React.createElement(TypeIconComponent, { className: "size-4 text-amber-600" })}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-ink">{typeLabel}</p>
                            <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                              {React.createElement(Clock, { className: "size-3" })}
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
                          {React.createElement(ArrowRight, { className: "mt-1 size-4 shrink-0 text-border transition-transform group-hover:translate-x-1" })}
                        </div>
                      </LocaleLink>
                    );
                  })}
                </div>

                {historyTotal > HISTORY_LIMIT && (
                  <div className="mt-5 flex items-center justify-center gap-3">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={historyPage === 1}
                      onClick={() => fetchHistory(historyPage - 1)}
                    >
                      {React.createElement(ChevronLeft, { className: "size-4" })}
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
                      {React.createElement(ChevronRight, { className: "size-4" })}
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
