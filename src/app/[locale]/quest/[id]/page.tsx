"use client";

import { useEffect, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Sparkles,
  Trophy,
  MapPin,
  XCircle,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Link } from "@/i18n/navigation";
import {
  QuestTimeline,
  type MissionSummary,
} from "@/components/quest/QuestTimeline";
import {
  MissionDetail,
  type MissionData,
} from "@/components/quest/MissionDetail";

interface QuestData {
  id: string;
  dream: string;
  localContext: string;
  status: string;
  generatedAt: string | null;
  createdAt: string;
  missions: MissionData[];
  completedCount: number;
  totalMissions: number;
}

export default function QuestOverviewPage() {
  const t = useTranslations("quest.overview");
  const params = useParams();
  const router = useRouter();
  const questId = params.id as string;

  const [quest, setQuest] = useState<QuestData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [lockedToast, setLockedToast] = useState(false);
  const [showAbandonDialog, setShowAbandonDialog] = useState(false);
  const [abandonLoading, setAbandonLoading] = useState(false);
  const [abandonError, setAbandonError] = useState<string | null>(null);

  const fetchQuest = useCallback(async () => {
    try {
      const res = await fetch(`/api/quest/${questId}`);
      if (!res.ok) {
        setError(true);
        return;
      }
      const data = await res.json();
      setQuest(data);

      // Auto-select the first available or in-progress mission
      const activeMission = data.missions.find(
        (m: MissionData) =>
          m.status === "available" || m.status === "in_progress",
      );
      if (activeMission) {
        setSelectedDay(activeMission.day);
      } else if (data.missions.length > 0) {
        // If all completed or all locked, select Day 1
        setSelectedDay(1);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [questId]);

  useEffect(() => {
    fetchQuest();
  }, [fetchQuest]);

  const handleStatusChange = useCallback(() => {
    // Refetch quest data to update all statuses
    fetchQuest();
  }, [fetchQuest]);

  const handleAbandonQuest = useCallback(async () => {
    setAbandonLoading(true);
    setAbandonError(null);
    try {
      const res = await fetch(`/api/quest/${questId}/abandon`, {
        method: "POST",
      });
      if (!res.ok) {
        throw new Error("Failed to abandon quest");
      }
      setShowAbandonDialog(false);
      // Navigate to quest list
      router.push("/quest");
    } catch {
      setAbandonError(t("abandonError"));
    } finally {
      setAbandonLoading(false);
    }
  }, [questId, t, router]);

  const handleSelectDay = useCallback(
    (day: number) => {
      if (!quest) return;
      const mission = quest.missions.find((m) => m.day === day);
      if (!mission) return;

      if (mission.status === "locked") {
        setLockedToast(true);
        setTimeout(() => setLockedToast(false), 3000);
        return;
      }

      setSelectedDay(day);
    },
    [quest],
  );

  const selectedMission = quest?.missions.find(
    (m) => m.day === selectedDay,
  );

  // Loading state
  if (loading) {
    return (
      <div className="mx-auto flex w-full max-w-5xl flex-col items-center justify-center px-4 py-16">
        <div className="size-12 animate-spin rounded-full border-4 border-zinc-200 border-t-blue-500" />
        <p className="mt-4 text-zinc-600 dark:text-zinc-400">
          {t("loading")}
        </p>
      </div>
    );
  }

  // Error / not found
  if (error || !quest) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col items-center justify-center px-4 py-16">
        <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
          {t("notFound")}
        </h2>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          {t("notFoundDesc")}
        </p>
        <Link href="/quest">
          <Button variant="outline" className="mt-6">
            <ArrowLeft className="mr-2 size-4" />
            {t("backToQuests")}
          </Button>
        </Link>
      </div>
    );
  }

  const missionSummaries: MissionSummary[] = quest.missions.map((m) => ({
    id: m.id,
    day: m.day,
    title: m.title,
    status: m.status,
  }));

  const isCompleted = quest.status === "completed";
  const isAllDaysComplete = quest.completedCount === quest.totalMissions;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:py-8">
      {/* Back button */}
      <div className="mb-4">
        <Link href="/quest">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-1 size-4" />
            {t("backToQuests")}
          </Button>
        </Link>
      </div>

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl dark:text-zinc-50">
          {t("title")}
        </h1>
        <p className="mt-1 text-zinc-600 dark:text-zinc-400">
          {t("subtitle")}
        </p>

        {/* Dream */}
        <div className="mt-3 flex items-start gap-2 text-sm text-zinc-600 dark:text-zinc-400">
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
      </div>

      {/* Completed quest banner */}
      {(isCompleted || isAllDaysComplete) && (
        <div
          className="mb-6 rounded-xl border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-900/20"
          role="status"
        >
          <div className="flex items-center gap-3">
            <Trophy
              className="size-8 text-green-600 dark:text-green-400"
              aria-hidden="true"
            />
            <div>
              <h2 className="font-bold text-green-800 dark:text-green-300">
                {t("questCompleted")}
              </h2>
              <p className="text-sm text-green-700 dark:text-green-400">
                {isCompleted
                  ? t("readOnlyBanner")
                  : t("questCompletedDesc")}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Abandon quest button (only for active quests) */}
      {quest.status === "active" && (
        <div className="mb-4 flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAbandonDialog(true)}
            className="text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-950/20 dark:hover:text-red-300"
          >
            <XCircle className="mr-1 size-4" aria-hidden="true" />
            {t("abandonQuest")}
          </Button>
        </div>
      )}

      {/* Abandon confirmation dialog */}
      <Dialog open={showAbandonDialog} onOpenChange={setShowAbandonDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("confirmAbandon")}</DialogTitle>
            <DialogDescription>
              {t("confirmAbandonDesc")}
            </DialogDescription>
          </DialogHeader>
          {abandonError && (
            <div
              role="alert"
              className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/20 dark:text-red-400"
            >
              {abandonError}
            </div>
          )}
          <DialogFooter className="flex gap-2 sm:justify-end">
            <Button
              variant="outline"
              onClick={() => setShowAbandonDialog(false)}
              disabled={abandonLoading}
            >
              {t("cancelButton")}
            </Button>
            <Button
              variant="destructive"
              onClick={handleAbandonQuest}
              disabled={abandonLoading}
            >
              {abandonLoading ? (
                <Loader2
                  className="mr-2 size-4 animate-spin"
                  aria-hidden="true"
                />
              ) : (
                <XCircle className="mr-2 size-4" aria-hidden="true" />
              )}
              {t("confirmAbandonButton")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Locked toast notification */}
      {lockedToast && (
        <div
          className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-center text-sm text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-400"
          role="alert"
          aria-live="polite"
        >
          {t("lockedMessage")}
        </div>
      )}

      {/* Main content: responsive layout */}
      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Timeline panel */}
        <div className="w-full shrink-0 lg:w-80">
          <h2 className="sr-only">{t("timeline")}</h2>
          <QuestTimeline
            missions={missionSummaries}
            selectedDay={selectedDay}
            onSelectDay={handleSelectDay}
            completedCount={quest.completedCount}
            totalMissions={quest.totalMissions}
          />
        </div>

        {/* Mission detail panel */}
        <div className="min-w-0 flex-1">
          <h2 className="sr-only">{t("missionDetail")}</h2>
          {selectedMission ? (
            <div className="overflow-y-auto rounded-xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6 dark:border-zinc-700 dark:bg-zinc-900">
              <MissionDetail
                mission={selectedMission}
                questId={questId}
                onStatusChange={handleStatusChange}
                readOnly={isCompleted}
              />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-zinc-200 bg-zinc-50 px-6 py-16 text-center dark:border-zinc-700 dark:bg-zinc-900/50">
              <MapPin
                className="mb-3 size-10 text-zinc-300 dark:text-zinc-600"
                aria-hidden="true"
              />
              <p className="text-zinc-500 dark:text-zinc-400">
                {t("selectMission")}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
