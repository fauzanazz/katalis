"use client";

import { useEffect, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useParams } from "next/navigation";
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
import { Link } from "@/i18n/navigation";

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
    reasoning: string;
  }>;
}

type PageState = "loading" | "not-ready" | "celebration" | "submitted" | "skipped" | "error";

export default function QuestCompletePage() {
  const t = useTranslations("quest.complete");
  const tOverview = useTranslations("quest.overview");
  const params = useParams();
  const questId = params.id as string;

  const [quest, setQuest] = useState<QuestData | null>(null);
  const [pageState, setPageState] = useState<PageState>("loading");
  const [selectedPhotoUrl, setSelectedPhotoUrl] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchQuest() {
      try {
        const res = await fetch(`/api/quest/${questId}`);
        if (!res.ok) {
          setPageState("error");
          return;
        }
        const data = await res.json();
        setQuest(data);

        // Check if all missions are completed
        const allDone =
          data.completedCount === data.totalMissions &&
          data.missions.every(
            (m: MissionData) => m.status === "completed",
          );

        if (allDone) {
          setPageState("celebration");
        } else {
          setPageState("not-ready");
        }
      } catch {
        setPageState("error");
      }
    }
    fetchQuest();
  }, [questId]);

  const handleSelectPhoto = useCallback(
    (photoUrl: string, day: number) => {
      setSelectedPhotoUrl(photoUrl);
      setSelectedDay(day);
      setSubmitError(null);
    },
    [],
  );

  const handleSubmitToGallery = useCallback(async () => {
    if (!selectedPhotoUrl) return;

    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch(`/api/quest/${questId}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selectedPhotoUrl }),
      });

      if (!res.ok) {
        throw new Error("Failed to submit to gallery");
      }

      setPageState("submitted");
    } catch {
      setSubmitError(t("submitError"));
    } finally {
      setSubmitting(false);
    }
  }, [questId, selectedPhotoUrl, t]);

  const handleSkipGallery = useCallback(async () => {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/quest/${questId}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skipGallery: true }),
      });

      if (!res.ok) {
        throw new Error("Failed to skip gallery");
      }

      setPageState("skipped");
    } catch {
      setSubmitError(t("submitError"));
    } finally {
      setSubmitting(false);
    }
  }, [questId, t]);

  // Loading state
  if (pageState === "loading") {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col items-center justify-center px-4 py-16">
        <div className="size-12 animate-spin rounded-full border-4 border-zinc-200 border-t-blue-500" />
        <p className="mt-4 text-zinc-600 dark:text-zinc-400">
          {t("loading")}
        </p>
      </div>
    );
  }

  // Error state
  if (pageState === "error") {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col items-center justify-center px-4 py-16">
        <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
          {tOverview("notFound")}
        </h2>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          {tOverview("notFoundDesc")}
        </p>
        <Link href="/quest">
          <Button variant="outline" className="mt-6">
            <ArrowLeft className="mr-2 size-4" />
            {tOverview("backToQuests")}
          </Button>
        </Link>
      </div>
    );
  }

  // Not ready state
  if (pageState === "not-ready") {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col items-center justify-center px-4 py-16">
        <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
          <Trophy
            className="size-8 text-amber-600 dark:text-amber-400"
            aria-hidden="true"
          />
        </div>
        <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
          {t("notReady")}
        </h2>
        <p className="mt-2 text-center text-zinc-600 dark:text-zinc-400">
          {t("notReadyDesc")}
        </p>
        <Link href={`/quest/${questId}`}>
          <Button variant="outline" className="mt-6">
            <ArrowLeft className="mr-2 size-4" />
            {t("backToQuest")}
          </Button>
        </Link>
      </div>
    );
  }

  // Submitted / skipped state
  if (pageState === "submitted" || pageState === "skipped") {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col items-center justify-center px-4 py-16">
        <div
          role="status"
          aria-live="polite"
          className="sr-only"
        >
          {t("celebrationAnnouncement")}
        </div>

        {/* Celebration visual */}
        <div className="mb-6 flex size-24 items-center justify-center rounded-full bg-gradient-to-br from-green-400 to-emerald-500 shadow-lg shadow-green-200 dark:shadow-green-900/30">
          <CheckCircle2
            className="size-12 text-white"
            aria-hidden="true"
          />
        </div>

        {pageState === "submitted" && (
          <>
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
              {t("submitSuccess")}
            </h2>
            <p className="mt-2 text-center text-zinc-600 dark:text-zinc-400">
              {t("encouragement")}
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/gallery">
                <Button size="lg">
                  <MapPin className="mr-2 size-5" />
                  {t("viewGallery")}
                </Button>
              </Link>
              <Link href="/quest">
                <Button variant="outline" size="lg">
                  {tOverview("backToQuests")}
                </Button>
              </Link>
            </div>
          </>
        )}

        {pageState === "skipped" && (
          <>
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
              {t("title")}
            </h2>
            <p className="mt-2 text-center text-zinc-600 dark:text-zinc-400">
              {t("encouragement")}
            </p>
            <div className="mt-8">
              <Link href="/quest">
                <Button variant="outline" size="lg">
                  <ArrowLeft className="mr-2 size-4" />
                  {tOverview("backToQuests")}
                </Button>
              </Link>
            </div>
          </>
        )}
      </div>
    );
  }

  // Celebration state (main flow)
  if (!quest) return null;

  const photosUploaded = quest.missions.filter(
    (m) => m.proofPhotoUrl,
  ).length;

  const topTalent = quest.detectedTalents?.[0]?.name ?? "Creative";

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:py-8">
      {/* Screen reader announcement */}
      <div
        role="status"
        aria-live="polite"
        className="sr-only"
      >
        {t("celebrationAnnouncement")}
      </div>

      {/* Back button */}
      <div className="mb-4">
        <Link href={`/quest/${questId}`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-1 size-4" />
            {t("backToQuest")}
          </Button>
        </Link>
      </div>

      {/* Celebration header */}
      <div className="mb-8 text-center">
        <div className="mb-4 flex justify-center">
          <div className="relative">
            <div className="flex size-20 items-center justify-center rounded-full bg-gradient-to-br from-yellow-400 via-amber-500 to-orange-500 shadow-lg shadow-amber-200 dark:shadow-amber-900/30">
              <Trophy
                className="size-10 text-white"
                aria-hidden="true"
              />
            </div>
            {/* Decorative sparkles */}
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

        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl dark:text-zinc-50">
          {t("title")}
        </h1>
        <p className="mt-2 text-lg text-zinc-600 dark:text-zinc-400">
          {t("congratulations")}
        </p>
      </div>

      {/* Journey summary */}
      <section
        className="mb-8 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
        aria-labelledby="journey-summary"
      >
        <h2
          id="journey-summary"
          className="mb-4 text-lg font-bold text-zinc-900 dark:text-zinc-50"
        >
          {t("summary")}
        </h2>

        {/* Dream */}
        <div className="mb-4 flex items-start gap-2 text-sm text-zinc-600 dark:text-zinc-400">
          <Sparkles
            className="mt-0.5 size-4 shrink-0 text-purple-500"
            aria-hidden="true"
          />
          <div>
            <span className="font-medium text-zinc-700 dark:text-zinc-300">
              {t("dreamLabel")}:
            </span>{" "}
            {quest.dream}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-800 dark:bg-green-900/20">
            <CheckCircle2
              className="size-6 text-green-600 dark:text-green-400"
              aria-hidden="true"
            />
            <span className="text-sm font-medium text-green-700 dark:text-green-300">
              {t("missionsCompleted", {
                count: quest.completedCount,
              })}
            </span>
          </div>
          <div className="flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-900/20">
            <Camera
              className="size-6 text-blue-600 dark:text-blue-400"
              aria-hidden="true"
            />
            <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
              {t("photosUploaded", { count: photosUploaded })}
            </span>
          </div>
        </div>

        <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
          {t("journeySummary")}
        </p>
      </section>

      {/* Best work selection */}
      <section
        className="mb-8 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
        aria-labelledby="best-work-selection"
      >
        <h2
          id="best-work-selection"
          className="mb-2 text-lg font-bold text-zinc-900 dark:text-zinc-50"
        >
          {t("selectBestWork")}
        </h2>
        <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
          {t("selectBestWorkDesc")}
        </p>

        <div
          className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4"
          role="radiogroup"
          aria-label={t("selectBestWork")}
        >
          {quest.missions
            .filter((m) => m.proofPhotoUrl)
            .map((mission) => {
              const isSelected =
                selectedPhotoUrl === mission.proofPhotoUrl;

              return (
                <button
                  key={mission.id}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  aria-label={t("dayPhoto", {
                    day: mission.day,
                    title: mission.title,
                  })}
                  onClick={() =>
                    handleSelectPhoto(
                      mission.proofPhotoUrl!,
                      mission.day,
                    )
                  }
                  className={`group relative overflow-hidden rounded-lg border-2 transition-all ${
                    isSelected
                      ? "border-blue-500 ring-2 ring-blue-300 dark:ring-blue-700"
                      : "border-zinc-200 hover:border-blue-300 dark:border-zinc-700 dark:hover:border-blue-600"
                  }`}
                >
                  <div className="aspect-square overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={mission.proofPhotoUrl!}
                      alt={t("photoAlt", {
                        day: mission.day,
                        title: mission.title,
                      })}
                      className="size-full object-cover transition-transform group-hover:scale-105"
                    />
                  </div>

                  {/* Day label */}
                  <div
                    className={`absolute bottom-0 left-0 right-0 px-2 py-1 text-xs font-medium ${
                      isSelected
                        ? "bg-blue-600 text-white"
                        : "bg-black/60 text-white"
                    }`}
                  >
                    Day {mission.day}
                  </div>

                  {/* Selection indicator */}
                  {isSelected && (
                    <div className="absolute right-1 top-1 flex size-6 items-center justify-center rounded-full bg-blue-600 text-white">
                      <CheckCircle2
                        className="size-4"
                        aria-hidden="true"
                      />
                    </div>
                  )}
                </button>
              );
            })}
        </div>

        {/* Selection label */}
        {selectedDay !== null && (
          <p className="mt-3 text-sm font-medium text-blue-600 dark:text-blue-400">
            {t("selectedPhoto", { day: selectedDay })}
          </p>
        )}
      </section>

      {/* Gallery preview */}
      {selectedPhotoUrl && (
        <section
          className="mb-8 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
          aria-labelledby="gallery-preview"
        >
          <h2
            id="gallery-preview"
            className="mb-2 text-lg font-bold text-zinc-900 dark:text-zinc-50"
          >
            {t("previewTitle")}
          </h2>
          <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
            {t("previewDesc")}
          </p>

          <div
            className="overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800"
            aria-label={t("galleryEntryPreview")}
          >
            <div className="aspect-video overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={selectedPhotoUrl}
                alt={t("photoAlt", {
                  day: selectedDay ?? 0,
                  title:
                    quest.missions.find(
                      (m) => m.day === selectedDay,
                    )?.title ?? "",
                })}
                className="size-full object-cover"
              />
            </div>
            <div className="p-4">
              <div className="flex items-center gap-2 text-sm">
                <ImageIcon
                  className="size-4 text-zinc-400"
                  aria-hidden="true"
                />
                <span className="font-medium text-zinc-700 dark:text-zinc-300">
                  {t("talentLabel")}:
                </span>{" "}
                <span className="text-zinc-600 dark:text-zinc-400">
                  {topTalent}
                </span>
              </div>
              <div className="mt-1 flex items-center gap-2 text-sm">
                <MapPin
                  className="size-4 text-zinc-400"
                  aria-hidden="true"
                />
                <span className="font-medium text-zinc-700 dark:text-zinc-300">
                  {t("locationLabel")}:
                </span>{" "}
                <span className="text-zinc-600 dark:text-zinc-400">
                  {quest.localContext}
                </span>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Error message */}
      {submitError && (
        <div
          role="alert"
          className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-center text-sm text-red-700 dark:border-red-800 dark:bg-red-950/20 dark:text-red-400"
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
            <Loader2
              className="mr-2 size-5 animate-spin"
              aria-hidden="true"
            />
          ) : (
            <MapPin className="mr-2 size-5" aria-hidden="true" />
          )}
          {submitting ? t("submitting") : t("submitToGallery")}
        </Button>

        <Button
          size="lg"
          variant="outline"
          onClick={handleSkipGallery}
          disabled={submitting}
        >
          {t("skipGallery")}
        </Button>
      </div>
    </div>
  );
}
