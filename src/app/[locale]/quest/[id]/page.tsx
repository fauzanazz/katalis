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
      <div className="quest-paper flex min-h-[100dvh] flex-col items-center justify-center px-4 py-16">
        <BouncyDots label={t("loading")} />
      </div>
    );
  }

  if (error || !quest) {
    return (
      <div className="quest-paper flex min-h-[100dvh] flex-col items-center justify-center px-4 py-16 text-center">
        <Compass
          className="mb-4 size-14 text-[color:var(--ink)] animate-bobble"
          aria-hidden="true"
        />
        <h2
          className="text-3xl text-[color:var(--ink)]"
          style={{ fontFamily: "var(--font-luckiest-guy)" }}
        >
          {t("notFound")}
        </h2>
        <p
          className="mt-2 text-lg text-[color:var(--muted-foreground)]"
          style={{ fontFamily: "var(--font-schoolbell)" }}
        >
          {t("notFoundDesc")}
        </p>
        <Link href="/quest" className="mt-6 inline-block">
          <Button
            variant="outline"
            className="sticker-press border-2 border-[color:var(--ink)] bg-[color:var(--yellow-sun)] text-[color:var(--ink)] shadow-[3px_3px_0_0_var(--ink)] hover:bg-[color:var(--yellow-sun-light)]"
          >
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
    <div className="quest-paper min-h-[100dvh]">
      <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:py-8">
        {/* Back button — chunky pill */}
        <div className="mb-5">
          <Link href="/quest">
            <Button
              variant="ghost"
              size="sm"
              className="sticker-press rounded-full border-2 border-[color:var(--ink)] bg-[#fffdf6] px-3 text-[color:var(--ink)] shadow-[2px_2px_0_0_var(--ink)] hover:bg-[color:var(--yellow-sun-light)]"
            >
              <ArrowLeft className="mr-1 size-4" />
              {t("backToQuests")}
            </Button>
          </Link>
        </div>

        {/* Header — chunky title + mascot greeting */}
        <header className="relative mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <span
              className="inline-flex items-center gap-1 rounded-full bg-[color:var(--pink-bloom-soft)] px-3 py-0.5 text-[11px] font-black uppercase tracking-[0.18em] text-[color:var(--ink)]"
              style={{ fontFamily: "var(--font-montserrat)" }}
            >
              <Sparkles className="size-3" aria-hidden="true" />
              7-day adventure
            </span>
            <h1
              className="mt-2 text-[clamp(2.5rem,6vw,4rem)] leading-[0.95] text-[color:var(--ink)]"
              style={{ fontFamily: "var(--font-luckiest-guy)" }}
            >
              {t("title")}
            </h1>
            <p
              className="mt-1 text-xl text-[color:var(--muted-foreground)]"
              style={{ fontFamily: "var(--font-schoolbell)" }}
            >
              {t("subtitle")}
            </p>

            {/* Dream — thought-bubble sticker */}
            <div
              className="sticker-card relative mt-4 inline-flex max-w-full items-start gap-2 px-4 py-3 sm:max-w-2xl"
            >
              <span
                aria-hidden="true"
                className="tape-strip left-6 top-[-9px] rotate-[-4deg] rounded-[2px]"
              />
              <Sparkles
                className="mt-0.5 size-5 shrink-0 text-[color:var(--yellow-sun-deep)]"
                aria-hidden="true"
              />
              <div className="min-w-0">
                <span
                  className="block text-[10px] font-black uppercase tracking-[0.18em] text-[color:var(--blue-ocean-deep)]"
                  style={{ fontFamily: "var(--font-montserrat)" }}
                >
                  {t("dreamLabel")}
                </span>
                <span
                  className="block text-lg leading-snug text-[color:var(--ink)]"
                  style={{ fontFamily: "var(--font-schoolbell)" }}
                >
                  {quest.dream}
                </span>
              </div>
            </div>
          </div>

          {/* Mascot compass — desktop only, decorative */}
          <div className="hidden shrink-0 sm:block" aria-hidden="true">
            <div className="relative inline-block animate-bobble">
              <Compass className="size-20 text-[color:var(--blue-ocean-deep)]" />
              <Sparkles className="absolute -right-2 -top-1 size-5 text-[color:var(--yellow-sun-deep)] animate-sway" />
            </div>
          </div>
        </header>

        {/* Completed quest banner */}
        {(isCompleted || isAllDaysComplete) && (
          <div
            className="sticker-card relative mb-6 flex flex-wrap items-center justify-between gap-4 px-5 py-4"
            role="status"
            style={{
              background:
                "color-mix(in srgb, var(--green-leaf-light) 80%, white)",
            }}
          >
            <span
              aria-hidden="true"
              className="tape-strip left-8 top-[-9px] rotate-[-5deg] rounded-[2px]"
            />
            <div className="flex items-center gap-3">
              <Trophy
                className="size-10 text-[color:var(--yellow-sun-deep)] animate-sway"
                aria-hidden="true"
              />
              <div>
                <h2
                  className="text-2xl text-[color:var(--ink)]"
                  style={{ fontFamily: "var(--font-luckiest-guy)" }}
                >
                  {t("questCompleted")}
                </h2>
                <p
                  className="text-base text-[color:var(--ink)]"
                  style={{ fontFamily: "var(--font-schoolbell)" }}
                >
                  {isCompleted
                    ? t("readOnlyBanner")
                    : t("questCompletedDesc")}
                </p>
              </div>
            </div>
            <Link href={`/quest/${questId}/complete`}>
              <Button
                size="sm"
                className="sticker-press shrink-0 rounded-full border-2 border-[color:var(--ink)] bg-[color:var(--yellow-sun)] text-[color:var(--ink)] shadow-[3px_3px_0_0_var(--ink)] hover:bg-[color:var(--yellow-sun-light)]"
              >
                <Trophy className="mr-1 size-4" aria-hidden="true" />
                {t("viewCompletion")}
              </Button>
            </Link>
          </div>
        )}

        {/* Badge collection */}
        <div className="mb-6">
          <BadgeGrid />
        </div>

        {/* Abandon quest button (only for active quests) */}
        {quest.status === "active" && (
          <div className="mb-4 flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAbandonDialog(true)}
              className="sticker-press rounded-full border-2 border-[color:var(--ink)] bg-[#fffdf6] text-[color:var(--destructive)] shadow-[2px_2px_0_0_var(--ink)] hover:bg-[color:var(--destructive)] hover:text-white"
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

        {/* Locked toast */}
        {lockedToast && (
          <div
            className="sticker-card-soft mb-4 bg-[color:var(--yellow-sun-light)] p-3 text-center text-sm font-bold text-[color:var(--ink)] animate-pop-in"
            role="alert"
            aria-live="polite"
          >
            {t("lockedMessage")}
          </div>
        )}

        {/* Main content */}
        <div className="flex flex-col gap-6 lg:flex-row">
          {/* Quest map panel */}
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

          {/* Mission detail panel */}
          <div className="min-w-0 flex-1">
            <h2 className="sr-only">{t("missionDetail")}</h2>
            {selectedMission ? (
              <div className="sticker-card overflow-y-auto p-5 sm:p-7">
                <MissionDetail
                  mission={selectedMission}
                  questId={questId}
                  onStatusChange={handleStatusChange}
                  readOnly={isCompleted}
                  onBadgesEarned={handleBadgesEarned}
                />
              </div>
            ) : (
              <div className="sticker-card flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
                <Compass
                  className="size-12 text-[color:var(--blue-ocean-deep)] animate-bobble"
                  aria-hidden="true"
                />
                <p
                  className="text-xl text-[color:var(--ink)]"
                  style={{ fontFamily: "var(--font-schoolbell)" }}
                >
                  {t("selectMission")}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Badge celebration toast */}
      {earnedBadges.length > 0 && (
        <BadgeToast badges={earnedBadges} onClose={() => setEarnedBadges([])} />
      )}
    </div>
  );
}
