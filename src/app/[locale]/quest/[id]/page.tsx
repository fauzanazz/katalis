"use client";

import { useEffect, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import { useRouter } from "@/i18n/navigation";
import {
  ArrowLeft,
  Sparkles,
  Trophy,
  Compass,
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
import { BadgeGrid } from "@/components/quest/BadgeGrid";
import { BadgeToast } from "@/components/quest/BadgeToast";
import { KidPageShell } from "@/components/layout/KidPageShell";
import type { EarnedBadge } from "@/lib/badges";

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

function BouncyDots({ label }: { label: string }) {
  return (
    <div
      className="flex flex-col items-center gap-4"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-end gap-2" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="block size-4 rounded-full border-2 border-[color:var(--ink)] bg-[color:var(--yellow-sun)] shadow-[1px_1px_0_0_var(--ink)]"
            style={{
              animation: "quest-bounce-dots 1.1s ease-in-out infinite",
              animationDelay: `${i * 0.15}s`,
            }}
          />
        ))}
      </div>
      <p
        className="text-lg text-[color:var(--ink)]"
        style={{ fontFamily: "var(--font-schoolbell)" }}
      >
        {label}
      </p>
    </div>
  );
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
  const [earnedBadges, setEarnedBadges] = useState<EarnedBadge[]>([]);
  const [badgeRefreshKey, setBadgeRefreshKey] = useState(0);

  const fetchQuest = useCallback(async () => {
    try {
      const res = await fetch(`/api/quest/${questId}`);
      if (!res.ok) {
        setError(true);
        return;
      }
      const data = await res.json();
      setQuest(data);

      const activeMission = data.missions.find(
        (m: MissionData) =>
          m.status === "available" || m.status === "in_progress",
      );
      if (activeMission) {
        setSelectedDay(activeMission.day);
      } else if (data.missions.length > 0) {
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
    fetchQuest();
  }, [fetchQuest]);

  const handleBadgesEarned = useCallback((badges: EarnedBadge[]) => {
    if (badges.length > 0) {
      setEarnedBadges(badges);
      setBadgeRefreshKey((k) => k + 1);
    }
  }, []);

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

  if (loading) {
    return (
      <section className="relative flex flex-1 items-center justify-center overflow-hidden bg-[#F5C542] px-6 py-16">
        <BouncyDots label={t("loading")} />
      </section>
    );
  }

  if (error || !quest) {
    return (
      <section className="relative flex flex-1 flex-col items-center justify-center overflow-hidden bg-[#F5C542] px-6 py-16 text-center">
        <div className="mb-6 inline-flex size-20 items-center justify-center rounded-2xl border-2 border-black bg-white shadow-[3px_3px_0_#000]">
          <Compass className="size-10 text-black" strokeWidth={2} aria-hidden="true" />
        </div>
        <h2 className="text-3xl font-black tracking-tight text-black sm:text-4xl">
          {t("notFound")}
        </h2>
        <p className="mt-2 text-base font-semibold text-black/65 sm:text-lg">
          {t("notFoundDesc")}
        </p>
        <Link href="/quest" className="mt-6 inline-block">
          <Button
            variant="outline"
            className="rounded-full border-2 border-black bg-white font-black text-black shadow-[3px_3px_0_#000] hover:bg-white hover:brightness-95 active:shadow-[1px_1px_0_#000]"
          >
            <ArrowLeft className="mr-2 size-4" />
            {t("backToQuests")}
          </Button>
        </Link>
      </section>
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
    <KidPageShell
      kicker={t("kicker")}
      title={t("title")}
      subtitle={t("subtitle")}
      actions={
        <Link href="/quest">
          <Button
            variant="ghost"
            size="sm"
            className="rounded-full border-2 border-black bg-white font-black text-black shadow-[3px_3px_0_#000] hover:bg-white hover:brightness-95 active:shadow-[1px_1px_0_#000]"
          >
            <ArrowLeft className="mr-1 size-4" />
            {t("backToQuests")}
          </Button>
        </Link>
      }
    >
      <div className="mb-6 inline-flex max-w-full items-start gap-3 rounded-2xl border-2 border-black bg-white px-5 py-4 shadow-[4px_4px_0_#000] sm:max-w-2xl">
        <Sparkles className="mt-0.5 size-5 shrink-0 text-black" aria-hidden="true" />
        <div className="min-w-0">
          <span className="block text-[10px] font-black uppercase tracking-[0.18em] text-black/60">
            {t("dreamLabel")}
          </span>
          <span className="block text-lg font-bold leading-snug text-black">
            {quest.dream}
          </span>
        </div>
      </div>

      {(isCompleted || isAllDaysComplete) && (
        <div
          className="relative mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border-2 border-black bg-[#B9E3C7] px-5 py-4 shadow-[4px_4px_0_#000]"
          role="status"
        >
          <div className="flex items-center gap-3">
            <Trophy className="size-10 text-black" aria-hidden="true" />
            <div>
              <h2 className="text-2xl font-black tracking-tight text-black">
                {t("questCompleted")}
              </h2>
              <p className="text-sm font-semibold text-black/70">
                {isCompleted ? t("readOnlyBanner") : t("questCompletedDesc")}
              </p>
            </div>
          </div>
          <Link href={`/quest/${questId}/complete`}>
            <Button
              size="sm"
              className="shrink-0 rounded-full border-2 border-black bg-[#F5C542] font-black text-black shadow-[3px_3px_0_#000] hover:bg-[#F5C542] hover:brightness-95 active:shadow-[1px_1px_0_#000]"
            >
              <Trophy className="mr-1 size-4" aria-hidden="true" />
              {t("viewCompletion")}
            </Button>
          </Link>
        </div>
      )}

      <div className="mb-6">
        <BadgeGrid refreshKey={badgeRefreshKey} />
      </div>

      {quest.status === "active" && (
        <div className="mb-4 flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAbandonDialog(true)}
            className="rounded-full border-2 border-black bg-white font-black text-red-700 shadow-[2px_2px_0_#000] hover:bg-red-700 hover:text-white active:shadow-[1px_1px_0_#000]"
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
                className="rounded-md border-2 border-[color:var(--destructive)] bg-red-50 p-3 text-sm text-[color:var(--destructive)]"
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

      {lockedToast && (
        <div
          className="mb-4 rounded-2xl border-2 border-black bg-white p-3 text-center text-sm font-bold text-black shadow-[3px_3px_0_#000]"
          role="alert"
          aria-live="polite"
        >
          {t("lockedMessage")}
        </div>
      )}

      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="w-full shrink-0 lg:w-[22rem]">
          <h2 className="sr-only">{t("timeline")}</h2>
          <QuestTimeline
            missions={missionSummaries}
            selectedDay={selectedDay}
            onSelectDay={handleSelectDay}
            completedCount={quest.completedCount}
            totalMissions={quest.totalMissions}
          />
        </div>

        <div className="min-w-0 flex-1">
          <h2 className="sr-only">{t("missionDetail")}</h2>
          {selectedMission ? (
            <div className="overflow-y-auto rounded-2xl border-2 border-black bg-white p-5 shadow-[4px_4px_0_#000] sm:p-7">
              <MissionDetail
                mission={selectedMission}
                questId={questId}
                onStatusChange={handleStatusChange}
                readOnly={isCompleted}
                onBadgesEarned={handleBadgesEarned}
              />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-black bg-white px-6 py-16 text-center shadow-[4px_4px_0_#000]">
              <Compass className="size-12 text-black" strokeWidth={2} aria-hidden="true" />
              <p className="text-lg font-bold text-black">{t("selectMission")}</p>
            </div>
          )}
        </div>
      </div>

      {earnedBadges.length > 0 && (
        <BadgeToast badges={earnedBadges} onClose={() => setEarnedBadges([])} />
      )}
    </KidPageShell>
  );
}
