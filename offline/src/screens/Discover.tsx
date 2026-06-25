import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Camera, CheckCircle2, Images, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { m } from "@/paraglide/messages";
import { useApp } from "../app/context";
import { QUESTS, getQuest } from "../data/content";
import { listProgress } from "../data/store";
import { evaluateAwards } from "../data/awards";
import { aiReachable, analyzeArtwork, type ArtworkAnalysis, type QuestCatalogEntry } from "../data/ai";
import { downscaleDataUrl, fileToDataUrl } from "../data/image";
import { t } from "../data/types";
import { STR } from "../strings";

type ScoutState = "idle" | "analyzing" | "done" | "error";

/** Render confidence as 1-3 filled sparkles. */
function confidenceStars(confidence: number): number {
  return confidence >= 0.8 ? 3 : confidence >= 0.55 ? 2 : 1;
}

export function Discover() {
  const { profile, locale } = useApp();
  const navigate = useNavigate();
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const [doneByQuest, setDoneByQuest] = useState<Record<string, number>>({});
  const [completed, setCompleted] = useState<Set<string>>(new Set());

  // Talent Scout state
  const [scoutState, setScoutState] = useState<ScoutState>("idle");
  const [scoutImage, setScoutImage] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<ArtworkAnalysis | null>(null);
  const [errorOffline, setErrorOffline] = useState(false);
  const [description, setDescription] = useState("");

  const catalog = useMemo<QuestCatalogEntry[]>(
    () => QUESTS.map((quest) => ({ id: quest.id, talent: quest.talent.en, theme: quest.theme })),
    [],
  );

  useEffect(() => {
    if (!profile) return;
    let active = true;
    listProgress(profile.id).then((rows) => {
      if (!active) return;
      const counts: Record<string, number> = {};
      const finished = new Set<string>();
      for (const row of rows) {
        counts[row.questId] = row.completedMissionIds.length;
        if (row.completedAt) finished.add(row.questId);
      }
      setDoneByQuest(counts);
      setCompleted(finished);
    });
    return () => {
      active = false;
    };
  }, [profile]);

  function openCamera() {
    cameraInputRef.current?.click();
  }

  function openGallery() {
    galleryInputRef.current?.click();
  }

  function resetScout() {
    setScoutState("idle");
    setScoutImage(null);
    setAnalysis(null);
    setErrorOffline(false);
    setDescription("");
  }

  async function handleScanFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !profile) return;

    let preview: string;
    try {
      preview = await downscaleDataUrl(await fileToDataUrl(file));
    } catch {
      setScoutImage(null);
      setErrorOffline(false);
      setScoutState("error");
      return;
    }
    setScoutImage(preview);
    // Exploring a creation earns the trailblazer badge — even offline, so it
    // fires before the AI-reachability gate below.
    void evaluateAwards(profile.id, { usedScout: true }).catch(() => {});

    if (!aiReachable()) {
      setErrorOffline(true);
      setScoutState("error");
      return;
    }

    setErrorOffline(false);
    setAnalysis(null);
    setScoutState("analyzing");
    try {
      const result = await analyzeArtwork(preview, {
        locale,
        childName: profile.name,
        catalog,
        description,
      });
      setAnalysis(result);
      setScoutState("done");
    } catch {
      setScoutState("error");
    }
  }

  const suggestedQuests =
    analysis?.recommendedQuestIds
      .map((id) => getQuest(id))
      .filter((quest): quest is NonNullable<typeof quest> => Boolean(quest)) ?? [];

  return (
    <div className="flex flex-col gap-5 p-5">
      <header className="pt-2">
        <h1 className="type-h2 text-ink">{m.discover_title()}</h1>
        <p className="text-muted-foreground">{m.discover_subtitle()}</p>
      </header>

      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={handleScanFile}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={handleScanFile}
      />

      {/* ── Talent Scout ──────────────────────────────────────────────── */}
      {scoutState === "idle" && (
        <div className="flex flex-col gap-3 rounded-3xl bg-pink-bloom-soft p-5 shadow-sm">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-pink-bloom/25 text-pink-bloom">
            <Sparkles className="size-6" aria-hidden />
          </span>
          <span className="text-lg font-bold text-ink">{t(STR.scoutTitle, locale)}</span>
          <span className="text-sm text-muted-foreground">{t(STR.scoutSubtitle, locale)}</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t(STR.scoutDescribe, locale)}
            rows={2}
            className="w-full resize-none rounded-2xl border border-border bg-plain-surface px-4 py-3 text-sm text-ink placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <div className="flex gap-2">
            <Button className="flex-1 active:scale-[0.98]" onClick={openCamera}>
              <Camera className="size-4" /> {t(STR.scoutTakePhoto, locale)}
            </Button>
            <Button variant="secondary" className="flex-1 active:scale-[0.98]" onClick={openGallery}>
              <Images className="size-4" /> {t(STR.scoutFromGallery, locale)}
            </Button>
          </div>
        </div>
      )}

      {scoutState === "analyzing" && (
        <div className="flex flex-col items-center gap-3 rounded-3xl bg-plain-surface p-5 text-center shadow-sm">
          {scoutImage && (
            <img src={scoutImage} alt="" className="size-28 rounded-2xl object-cover" />
          )}
          <p className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Sparkles className="size-4 animate-pulse text-pink-bloom" aria-hidden />
            {t(STR.scoutLooking, locale)}
          </p>
        </div>
      )}

      {scoutState === "error" && (
        <div className="flex flex-col items-center gap-3 rounded-3xl bg-yellow-sun-light p-5 text-center">
          {scoutImage && (
            <img src={scoutImage} alt="" className="size-24 rounded-2xl object-cover" />
          )}
          <p className="text-sm text-ink">
            {errorOffline ? t(STR.scoutOffline, locale) : t(STR.scoutError, locale)}
          </p>
          <Button size="sm" variant="secondary" onClick={resetScout}>
            <Camera className="size-4" /> {t(STR.scoutAgain, locale)}
          </Button>
        </div>
      )}

      {scoutState === "done" && analysis && (
        <div className="flex flex-col gap-4 rounded-3xl bg-plain-surface p-5 shadow-sm">
          <div className="flex items-start gap-3">
            {scoutImage && (
              <img src={scoutImage} alt="" className="size-20 shrink-0 rounded-2xl object-cover" />
            )}
            {analysis.encouragement && (
              <p className="text-sm font-medium text-ink">{analysis.encouragement}</p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              {t(STR.scoutTalents, locale)}
            </p>
            {analysis.talents.map((talent) => {
              const stars = confidenceStars(talent.confidence);
              return (
                <div key={talent.name} className="rounded-2xl bg-blue-ocean-light/60 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-ink">{talent.name}</span>
                    <span className="flex shrink-0 items-center gap-0.5" aria-hidden>
                      {Array.from({ length: 3 }, (_, i) => (
                        <Sparkles
                          key={i}
                          className={cn(
                            "size-3.5",
                            i < stars ? "text-yellow-sun-deep" : "text-muted-foreground/25",
                          )}
                        />
                      ))}
                    </span>
                  </div>
                  {talent.reason && (
                    <p className="mt-1 text-sm text-muted-foreground">{talent.reason}</p>
                  )}
                </div>
              );
            })}
          </div>

          {suggestedQuests.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                {t(STR.scoutSuggested, locale)}
              </p>
              {suggestedQuests.map((quest) => (
                <button
                  key={quest.id}
                  type="button"
                  onClick={() => navigate({ to: "/quest/$questId", params: { questId: quest.id } })}
                  className="flex items-center gap-3 rounded-2xl bg-green-leaf-light/70 p-3 text-left transition-transform active:scale-[0.98]"
                >
                  <span className="text-2xl" aria-hidden>{quest.emoji}</span>
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate font-semibold text-ink">{t(quest.title, locale)}</span>
                    <span className="truncate text-xs text-muted-foreground">{t(quest.talent, locale)}</span>
                  </span>
                </button>
              ))}
            </div>
          )}

          <Button variant="secondary" onClick={resetScout}>
            <Camera className="size-4" /> {t(STR.scoutAgain, locale)}
          </Button>
        </div>
      )}

      {/* ── Quest catalog ─────────────────────────────────────────────── */}
      <h2 className="type-h3 text-ink">{t(STR.allAdventures, locale)}</h2>

      <ul className="flex flex-col gap-4">
        {QUESTS.map((quest) => {
          const done = doneByQuest[quest.id] ?? 0;
          const isComplete = completed.has(quest.id);
          const started = done > 0;
          return (
            <li key={quest.id}>
              <button
                type="button"
                onClick={() => navigate({ to: "/quest/$questId", params: { questId: quest.id } })}
                className="flex w-full items-center gap-4 rounded-2xl bg-plain-surface p-4 text-left shadow-sm transition-transform active:scale-[0.98]"
              >
                <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-blue-ocean-light text-3xl" aria-hidden>
                  {quest.emoji}
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-lg font-bold text-ink">{t(quest.title, locale)}</span>
                    {isComplete && <CheckCircle2 className="size-5 shrink-0 text-green-leaf-deep" aria-hidden />}
                  </span>
                  <span className="line-clamp-2 text-sm text-muted-foreground">{t(quest.summary, locale)}</span>
                  <span className="mt-1 inline-flex items-center gap-1 self-start rounded-full bg-yellow-sun-light px-2 py-0.5 text-xs font-medium text-ink">
                    <Sparkles className="size-3" aria-hidden /> {t(STR.exploreTalent, locale)}: {t(quest.talent, locale)}
                  </span>
                  {started && !isComplete && (
                    <span className="text-xs font-medium text-primary">
                      {t(STR.day, locale)} {done}/{quest.missions.length}
                    </span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
