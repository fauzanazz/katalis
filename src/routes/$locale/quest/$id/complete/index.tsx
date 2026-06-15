import { useState, useCallback } from "react";
import { createFileRoute, notFound } from "@tanstack/react-router";
import {
  ArrowLeft,
  Trophy,
  Camera,
  Sparkles,
  Star,
  CheckCircle2,
  Loader2,
  MapPin,
  ImageIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { LocaleLink } from "@/i18n/start-navigation";
import { m } from "@/paraglide/messages";
import { getQuestByIdFn, completeQuestFn } from "@/lib/server/quest";

interface MissionData {
  id: string;
  day: number;
  title: string;
  description: string;
  status: string;
  proofPhotoUrl: string | null;
}

interface QuestData {
  id: string;
  dream: string;
  localContext: string;
  status: string;
  missions: MissionData[];
  completedCount: number;
  totalMissions: number;
  detectedTalents: Array<{
    name: string;
    confidence: number;
  }>;
}

export const Route = createFileRoute("/$locale/quest/$id/complete/")({
  loader: async ({ params }) => {
    const result = await getQuestByIdFn({ data: { id: params.id } });
    if (!result.ok) {
      if (result.error === "unauthorized") {
        throw notFound();
      }
      throw notFound();
    }

    const allDone =
      result.completedCount === result.totalMissions &&
      result.missions.every((m) => m.status === "completed");

    return {
      quest: {
        id: result.id,
        dream: result.dream,
        localContext: result.localContext,
        status: result.status,
        missions: result.missions,
        completedCount: result.completedCount,
        totalMissions: result.totalMissions,
        detectedTalents: result.detectedTalents,
      } satisfies QuestData,
      allDone,
    };
  },
  head: () => ({
    meta: [{ title: m.quest_complete_title() }],
  }),
  component: QuestCompletePage,
});

type PageState = "celebration" | "not-ready" | "submitted" | "skipped" | "error";

function QuestCompletePage() {
  const { quest, allDone } = Route.useLoaderData();
  const { id: questId } = Route.useParams();

  const [pageState, setPageState] = useState<PageState>(allDone ? "celebration" : "not-ready");
  const [selectedPhotoUrl, setSelectedPhotoUrl] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleSelectPhoto = useCallback((photoUrl: string, day: number) => {
    setSelectedPhotoUrl(photoUrl);
    setSelectedDay(day);
    setSubmitError(null);
  }, []);

  const handleSubmitToGallery = useCallback(async () => {
    if (!selectedPhotoUrl) return;

    setSubmitting(true);
    setSubmitError(null);
    try {
      const result = await completeQuestFn({
        data: { id: questId, selectedPhotoUrl },
      });
      if (!result.ok) {
        setSubmitError(m.quest_complete_submitError());
        return;
      }
      setPageState("submitted");
    } catch {
      setSubmitError(m.quest_complete_submitError());
    } finally {
      setSubmitting(false);
    }
  }, [questId, selectedPhotoUrl]);

  const handleSkipGallery = useCallback(async () => {
    setSubmitting(true);
    try {
      const result = await completeQuestFn({
        data: { id: questId, skipGallery: true },
      });
      if (!result.ok) {
        setSubmitError(m.quest_complete_submitError());
        return;
      }
      setPageState("skipped");
    } catch {
      setSubmitError(m.quest_complete_submitError());
    } finally {
      setSubmitting(false);
    }
  }, [questId]);

  // Error state
  if (pageState === "error") {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col items-center justify-center px-4 py-16">
        <h2 className="text-xl font-bold text-ink">{m.quest_overview_notFound()}</h2>
        <p className="mt-2 text-muted-foreground">{m.quest_overview_notFoundDesc()}</p>
        <LocaleLink href="/quest">
          <Button variant="outline" className="mt-6">
            <ArrowLeft className="mr-2 size-4" />
            {m.quest_overview_backToQuests()}
          </Button>
        </LocaleLink>
      </div>
    );
  }

  // Not ready state
  if (pageState === "not-ready") {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col items-center justify-center px-4 py-16">
        <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-amber-100">
          <Trophy className="size-8 text-amber-600" aria-hidden="true" />
        </div>
        <h2 className="text-xl font-bold text-ink">{m.quest_complete_notReady()}</h2>
        <p className="mt-2 text-center text-muted-foreground">{m.quest_complete_notReadyDesc()}</p>
        <LocaleLink href={`/quest/${questId}`}>
          <Button variant="outline" className="mt-6">
            <ArrowLeft className="mr-2 size-4" />
            {m.quest_complete_backToQuest()}
          </Button>
        </LocaleLink>
      </div>
    );
  }

  // Submitted / skipped state
  if (pageState === "submitted" || pageState === "skipped") {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col items-center justify-center px-4 py-16">
        <div role="status" aria-live="polite" className="sr-only">
          {m.quest_complete_celebrationAnnouncement()}
        </div>

        <div className="mb-6 flex size-24 items-center justify-center rounded-full bg-gradient-to-br from-green-400 to-emerald-500 shadow-lg shadow-green-200">
          <CheckCircle2 className="size-12 text-white" aria-hidden="true" />
        </div>

        {pageState === "submitted" && (
          <>
            <h2 className="text-2xl font-bold text-ink">{m.quest_complete_submitSuccess()}</h2>
            <p className="mt-2 text-center text-muted-foreground">{m.quest_complete_encouragement()}</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <LocaleLink href="/gallery">
                <Button size="lg">
                  <MapPin className="mr-2 size-5" />
                  {m.quest_complete_viewGallery()}
                </Button>
              </LocaleLink>
              <LocaleLink href="/quest">
                <Button variant="outline" size="lg">
                  {m.quest_overview_backToQuests()}
                </Button>
              </LocaleLink>
            </div>
          </>
        )}

        {pageState === "skipped" && (
          <>
            <h2 className="text-2xl font-bold text-ink">{m.quest_complete_title()}</h2>
            <p className="mt-2 text-center text-muted-foreground">{m.quest_complete_encouragement()}</p>
            <div className="mt-8">
              <LocaleLink href="/quest">
                <Button variant="outline" size="lg">
                  <ArrowLeft className="mr-2 size-4" />
                  {m.quest_overview_backToQuests()}
                </Button>
              </LocaleLink>
            </div>
          </>
        )}
      </div>
    );
  }

  // Celebration state (main flow)
  const photosUploaded = quest.missions.filter((mission) => mission.proofPhotoUrl).length;
  const topTalent = quest.detectedTalents?.[0]?.name ?? "Creative";

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:py-8 bg-gradient-to-b from-amber-50 to-orange-100 min-h-screen">
      <div role="status" aria-live="polite" className="sr-only">
        {m.quest_complete_celebrationAnnouncement()}
      </div>

      {/* Back button */}
      <div className="mb-4">
        <LocaleLink href={`/quest/${questId}`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-1 size-4" />
            {m.quest_complete_backToQuest()}
          </Button>
        </LocaleLink>
      </div>

      {/* Celebration header */}
      <div className="mb-8 text-center">
        <div className="mb-4 flex justify-center">
          <div className="relative">
            <div className="flex size-20 items-center justify-center rounded-full bg-gradient-to-br from-yellow-400 via-amber-500 to-orange-500 shadow-lg shadow-amber-200">
              <Trophy className="size-10 text-white" aria-hidden="true" />
            </div>
            <Sparkles
              className="absolute -right-2 -top-2 size-6 text-yellow-400"
              aria-hidden="true"
            />
            <Star
              className="absolute -bottom-1 -left-3 size-5 text-amber-400"
              aria-hidden="true"
            />
          </div>
        </div>

        <h1 className="text-3xl font-bold tracking-tight text-ink sm:text-4xl">
          {m.quest_complete_title()}
        </h1>
        <p className="mt-2 text-lg text-muted-foreground">{m.quest_complete_congratulations()}</p>
      </div>

      {/* Journey summary */}
      <section
        className="mb-8 rounded-xl border border-border bg-card p-5 shadow-sm"
        aria-labelledby="journey-summary"
      >
        <h2 id="journey-summary" className="mb-4 text-lg font-bold text-ink">
          {m.quest_complete_summary()}
        </h2>

        <div className="mb-4 flex items-start gap-2 text-sm text-muted-foreground">
          <Sparkles className="mt-0.5 size-4 shrink-0 text-amber-500" aria-hidden="true" />
          <div>
            <span className="font-medium text-foreground">{m.quest_complete_dreamLabel()}:</span>{" "}
            {quest.dream}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 p-3">
            <CheckCircle2 className="size-6 text-green-600" aria-hidden="true" />
            <span className="text-sm font-medium text-green-700">
              {m.quest_complete_missionsCompleted({ count: quest.completedCount })}
            </span>
          </div>
          <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
            <Camera className="size-6 text-amber-600" aria-hidden="true" />
            <span className="text-sm font-medium text-amber-700">
              {m.quest_complete_photosUploaded({ count: photosUploaded })}
            </span>
          </div>
        </div>

        <p className="mt-4 text-sm text-muted-foreground">{m.quest_complete_journeySummary()}</p>
      </section>

      {/* Best work selection */}
      <section
        className="mb-8 rounded-xl border border-border bg-card p-5 shadow-sm"
        aria-labelledby="best-work-selection"
      >
        <h2 id="best-work-selection" className="mb-2 text-lg font-bold text-ink">
          {m.quest_complete_selectBestWork()}
        </h2>
        <p className="mb-4 text-sm text-muted-foreground">{m.quest_complete_selectBestWorkDesc()}</p>

        <div
          className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4"
          role="radiogroup"
          aria-label={m.quest_complete_selectBestWork()}
        >
          {quest.missions
            .filter((mission) => mission.proofPhotoUrl)
            .map((mission) => {
              const isSelected = selectedPhotoUrl === mission.proofPhotoUrl;

              return (
                <button
                  key={mission.id}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  aria-label={m.quest_complete_dayPhoto({ day: mission.day, title: mission.title })}
                  onClick={() => handleSelectPhoto(mission.proofPhotoUrl!, mission.day)}
                  className={`group relative overflow-hidden rounded-lg border-2 transition-all ${
                    isSelected
                      ? "border-amber-500 ring-2 ring-amber-300"
                      : "border-zinc-200 hover:border-amber-300"
                  }`}
                >
                  <div className="aspect-square overflow-hidden">
                    <img
                      src={mission.proofPhotoUrl!}
                      alt={m.quest_complete_photoAlt({ day: mission.day, title: mission.title })}
                      className="size-full object-cover transition-transform group-hover:scale-105"
                    />
                  </div>

                  <div
                    className={`absolute bottom-0 left-0 right-0 px-2 py-1 text-xs font-medium ${
                      isSelected ? "bg-amber-600 text-white" : "bg-black/60 text-white"
                    }`}
                  >
                    {m.quest_complete_dayLabel({ day: mission.day })}
                  </div>

                  {isSelected && (
                    <div className="absolute right-1 top-1 flex size-6 items-center justify-center rounded-full bg-amber-600 text-white">
                      <CheckCircle2 className="size-4" aria-hidden="true" />
                    </div>
                  )}
                </button>
              );
            })}
        </div>

        {selectedDay !== null && (
          <p className="mt-3 text-sm font-medium text-amber-600">
            {m.quest_complete_selectedPhoto({ day: selectedDay })}
          </p>
        )}
      </section>

      {/* Gallery preview */}
      {selectedPhotoUrl && (
        <section
          className="mb-8 rounded-xl border border-border bg-card p-5 shadow-sm"
          aria-labelledby="gallery-preview"
        >
          <h2 id="gallery-preview" className="mb-2 text-lg font-bold text-ink">
            {m.quest_complete_previewTitle()}
          </h2>
          <p className="mb-4 text-sm text-muted-foreground">{m.quest_complete_previewDesc()}</p>

          <div
            className="overflow-hidden rounded-lg border border-border bg-muted"
            aria-label={m.quest_complete_galleryEntryPreview()}
          >
            <div className="aspect-video overflow-hidden">
              <img
                src={selectedPhotoUrl}
                alt={m.quest_complete_photoAlt({
                  day: selectedDay ?? 0,
                  title:
                    quest.missions.find((mission) => mission.day === selectedDay)?.title ?? "",
                })}
                className="size-full object-cover"
              />
            </div>
            <div className="p-4">
              <div className="flex items-center gap-2 text-sm">
                <ImageIcon className="size-4 text-zinc-400" aria-hidden="true" />
                <span className="font-medium text-foreground">{m.quest_complete_talentLabel()}:</span>{" "}
                <span className="text-muted-foreground">{topTalent}</span>
              </div>
              <div className="mt-1 flex items-center gap-2 text-sm">
                <MapPin className="size-4 text-zinc-400" aria-hidden="true" />
                <span className="font-medium text-foreground">{m.quest_complete_locationLabel()}:</span>{" "}
                <span className="text-muted-foreground">{quest.localContext}</span>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Error message */}
      {submitError && (
        <div
          role="alert"
          className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-center text-sm text-red-700"
        >
          {submitError}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
        <Button
          size="lg"
          onClick={handleSubmitToGallery}
          disabled={!selectedPhotoUrl || submitting}
          className="sm:min-w-[200px]"
        >
          {submitting ? (
            <Loader2 className="mr-2 size-5 animate-spin" aria-hidden="true" />
          ) : (
            <MapPin className="mr-2 size-5" aria-hidden="true" />
          )}
          {submitting ? m.quest_complete_submitting() : m.quest_complete_submitToGallery()}
        </Button>

        <Button size="lg" variant="outline" onClick={handleSkipGallery} disabled={submitting}>
          {m.quest_complete_skipGallery()}
        </Button>
      </div>
    </div>
  );
}
