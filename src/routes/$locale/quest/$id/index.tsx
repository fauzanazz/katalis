import { useState, useCallback } from "react";
import {
  createFileRoute,
  notFound,
  redirect,
} from "@tanstack/react-router";
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
import { LocaleLink } from "@/i18n/start-navigation";
import { KidPageShell } from "@/components/layout/KidPageShell";
import {
  QuestTimeline,
  type MissionSummary,
} from "@/components/start/quest/QuestTimeline";
import {
  MissionDetail,
  type MissionData,
} from "@/components/start/quest/MissionDetail";
import { BadgeGrid } from "@/components/start/quest/BadgeGrid";
import { BadgeToast } from "@/components/start/quest/BadgeToast";
import { m } from "@/paraglide/messages";
import { getQuestByIdFn, abandonQuestFn } from "@/lib/server/quest";
import { useLocaleRouter } from "@/i18n/start-navigation";
import type { EarnedBadge } from "@/lib/badges";

export const Route = createFileRoute("/$locale/quest/$id/")({
  loader: async ({ params }) => {
    const result = await getQuestByIdFn({ data: { id: params.id } });
    if (!result.ok) {
      if (result.error === "not_found") throw notFound();
      if (result.error === "forbidden") throw notFound();
      if (result.error === "unauthorized") {
        throw redirect({ href: `/${params.locale}/login` });
      }
      throw notFound();
    }
    return {
      quest: {
        id: result.id,
        dream: result.dream,
        localContext: result.localContext,
        status: result.status,
        generatedAt: result.generatedAt,
        createdAt: result.createdAt,
        missions: result.missions as MissionData[],
        completedCount: result.completedCount,
        totalMissions: result.totalMissions,
      },
    };
  },
  component: QuestOverviewPage,
});

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

interface QuestState {
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

function QuestOverviewPage() {
  const { quest: initialQuest } = Route.useLoaderData();
  const { id: questId } = Route.useParams();
  const router = useLocaleRouter();

  const [quest, setQuest] = useState<QuestState>(initialQuest as QuestState);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDay, setSelectedDay] = useState<number | null>(() => {
    const activeMission = initialQuest.missions.find(
      (missionItem: MissionData) =>
        missionItem.status === "available" || missionItem.status === "in_progress",
    );
    if (activeMission) return activeMission.day;
    if (initialQuest.missions.length > 0) return 1;
    return null;
  });
  const [lockedToast, setLockedToast] = useState(false);
  const [showAbandonDialog, setShowAbandonDialog] = useState(false);
  const [abandonLoading, setAbandonLoading] = useState(false);
  const [abandonError, setAbandonError] = useState<string | null>(null);
  const [earnedBadges, setEarnedBadges] = useState<EarnedBadge[]>([]);
  const [badgeRefreshKey, setBadgeRefreshKey] = useState(0);

  const refreshQuest = useCallback(async () => {
    setRefreshing(true);
    try {
      const result = await getQuestByIdFn({ data: { id: questId } });
      if (result.ok) {
        setQuest({
          id: result.id,
          dream: result.dream,
          localContext: result.localContext,
          status: result.status,
          generatedAt: result.generatedAt,
          createdAt: result.createdAt,
          missions: result.missions as MissionData[],
          completedCount: result.completedCount,
          totalMissions: result.totalMissions,
        });

        const activeMission = result.missions.find(
          (missionItem) =>
            missionItem.status === "available" || missionItem.status === "in_progress",
        );
        if (activeMission) {
          setSelectedDay(activeMission.day);
        }
      }
    } catch {
      // Non-fatal — keep stale data
    } finally {
      setRefreshing(false);
    }
  }, [questId]);

  const handleStatusChange = useCallback(() => {
    refreshQuest();
  }, [refreshQuest]);

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
      const result = await abandonQuestFn({ data: { id: questId } });
      if (!result.ok) {
        setAbandonError(m.quest_overview_abandonError());
        return;
      }
      setShowAbandonDialog(false);
      router.push("/quest");
    } catch {
      setAbandonError(m.quest_overview_abandonError());
    } finally {
      setAbandonLoading(false);
    }
  }, [questId, router]);

  const handleSelectDay = useCallback(
    (day: number) => {
      const mission = quest.missions.find((missionItem) => missionItem.day === day);
      if (!mission) return;

      if (mission.status === "locked") {
        setLockedToast(true);
        setTimeout(() => setLockedToast(false), 3000);
        return;
      }

      setSelectedDay(day);
    },
    [quest.missions],
  );

  const selectedMission = quest.missions.find(
    (missionItem) => missionItem.day === selectedDay,
  );

  if (refreshing && !quest) {
    return (
      <section className="relative flex flex-1 items-center justify-center overflow-hidden bg-[#F5C542] px-6 py-16">
        <BouncyDots label={m.quest_overview_loading()} />
      </section>
    );
  }

  const missionSummaries: MissionSummary[] = quest.missions.map((missionItem) => ({
    id: missionItem.id,
    day: missionItem.day,
    title: missionItem.title,
    status: missionItem.status,
  }));

  const isCompleted = quest.status === "completed";
  const isAllDaysComplete = quest.completedCount === quest.totalMissions;

  return (
    <KidPageShell
      kicker={m.quest_overview_kicker()}
      title={m.quest_overview_title()}
      subtitle={m.quest_overview_subtitle()}
      actions={
        <LocaleLink href="/quest">
          <Button
            variant="ghost"
            size="sm"
            className="rounded-full border-2 border-black bg-white font-black text-black shadow-[3px_3px_0_#000] hover:bg-white hover:brightness-95 active:shadow-[1px_1px_0_#000]"
          >
            <ArrowLeft className="mr-1 size-4" />
            {m.quest_overview_backToQuests()}
          </Button>
        </LocaleLink>
      }
    >
      {/* Dream card */}
      <div className="mb-6 inline-flex max-w-full items-start gap-3 rounded-2xl border-2 border-black bg-white px-5 py-4 shadow-[4px_4px_0_#000] sm:max-w-2xl">
        <Sparkles className="mt-0.5 size-5 shrink-0 text-black" aria-hidden="true" />
        <div className="min-w-0">
          <span className="block text-[10px] font-black uppercase tracking-[0.18em] text-black/60">
            {m.quest_overview_dreamLabel()}
          </span>
          <span className="block text-lg font-bold leading-snug text-black">
            {quest.dream}
          </span>
        </div>
      </div>

      {/* Completed banner */}
      {(isCompleted || isAllDaysComplete) && (
        <div
          className="relative mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border-2 border-black bg-[#B9E3C7] px-5 py-4 shadow-[4px_4px_0_#000]"
          role="status"
        >
          <div className="flex items-center gap-3">
            <Trophy className="size-10 text-black" aria-hidden="true" />
            <div>
              <h2 className="text-2xl font-black tracking-tight text-black">
                {m.quest_overview_questCompleted()}
              </h2>
              <p className="text-sm font-semibold text-black/70">
                {isCompleted
                  ? m.quest_overview_readOnlyBanner()
                  : m.quest_overview_questCompletedDesc()}
              </p>
            </div>
          </div>
          <LocaleLink href={`/quest/${questId}/complete`}>
            <Button
              size="sm"
              className="shrink-0 rounded-full border-2 border-black bg-[#F5C542] font-black text-black shadow-[3px_3px_0_#000] hover:bg-[#F5C542] hover:brightness-95 active:shadow-[1px_1px_0_#000]"
            >
              <Trophy className="mr-1 size-4" aria-hidden="true" />
              {m.quest_overview_viewCompletion()}
            </Button>
          </LocaleLink>
        </div>
      )}

      {/* Badge grid */}
      <div className="mb-6">
        <BadgeGrid refreshKey={badgeRefreshKey} />
      </div>

      {/* Abandon button */}
      {quest.status === "active" && (
        <div className="mb-4 flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAbandonDialog(true)}
            className="rounded-full border-2 border-black bg-white font-black text-red-700 shadow-[2px_2px_0_#000] hover:bg-red-700 hover:text-white active:shadow-[1px_1px_0_#000]"
          >
            <XCircle className="mr-1 size-4" aria-hidden="true" />
            {m.quest_overview_abandonQuest()}
          </Button>
        </div>
      )}

      {/* Abandon confirmation dialog */}
      <Dialog open={showAbandonDialog} onOpenChange={setShowAbandonDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{m.quest_overview_confirmAbandon()}</DialogTitle>
            <DialogDescription>
              {m.quest_overview_confirmAbandonDesc()}
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
              {m.quest_overview_cancelButton()}
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
              {m.quest_overview_confirmAbandonButton()}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Locked mission inline toast */}
      {lockedToast && (
        <div
          className="mb-4 rounded-2xl border-2 border-black bg-white p-3 text-center text-sm font-bold text-black shadow-[3px_3px_0_#000]"
          role="alert"
          aria-live="polite"
        >
          {m.quest_overview_lockedMessage()}
        </div>
      )}

      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="w-full shrink-0 lg:w-[22rem]">
          <h2 className="sr-only">{m.quest_overview_timeline()}</h2>
          <QuestTimeline
            missions={missionSummaries}
            selectedDay={selectedDay}
            onSelectDay={handleSelectDay}
            completedCount={quest.completedCount}
            totalMissions={quest.totalMissions}
          />
        </div>

        <div className="min-w-0 flex-1">
          <h2 className="sr-only">{m.quest_overview_missionDetail()}</h2>
          {selectedMission ? (
            <div className="min-h-[700px] overflow-y-auto rounded-2xl border-2 border-black bg-white p-5 shadow-[4px_4px_0_#000] sm:p-7">
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
              <p className="text-lg font-bold text-black">{m.quest_overview_selectMission()}</p>
            </div>
          )}
        </div>
      </div>

      {/* Badge toast on badges earned */}
      {earnedBadges.length > 0 && (
        <BadgeToast badges={earnedBadges} onClose={() => setEarnedBadges([])} />
      )}
    </KidPageShell>
  );
}
