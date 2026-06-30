import React, { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { motion } from "motion/react";
import {
  ArrowRight,
  Trophy,
  Clock,
  Archive,
  Plus,
  Compass,
  Map,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { LocaleLink, useLocaleRouter } from "@/i18n/start-navigation";
import { useChildId } from "@/hooks/use-child-id";
import { KidPageShell } from "@/components/layout/KidPageShell";
import { m } from "@/paraglide/messages";
import { getAuthSessionFn } from "@/lib/server/auth";
import { listQuestsFn } from "@/lib/server/quest";

interface QuestMissionSummary {
  day: number;
  title: string;
  status: string;
}

interface QuestListItem {
  id: string;
  dream: string;
  status: string;
  createdAt: string;
  completedCount: number;
  totalMissions: number;
  missions: QuestMissionSummary[];
}

// All color values reference design-system CSS variables
const STATUS_CONFIG = {
  completed: {
    icon: Trophy,
    iconColorVar: "var(--green-leaf-deep)",
    iconBgClass: "bg-green-leaf-light",
    badgeBgClass: "bg-green-leaf-light",
    badgeTextClass: "text-green-leaf-deep",
    dotColorVar: "var(--green-leaf-deep)",
    borderColorVar: "var(--green-leaf)",
  },
  abandoned: {
    icon: Archive,
    iconColorVar: "var(--muted-foreground)",
    iconBgClass: "bg-muted",
    badgeBgClass: "bg-muted",
    badgeTextClass: "text-muted-foreground",
    dotColorVar: "var(--border)",
    borderColorVar: "var(--border)",
  },
  active: {
    icon: Clock,
    iconColorVar: "var(--yellow-sun-deep)",
    iconBgClass: "bg-general-surface",
    badgeBgClass: "bg-general-surface",
    badgeTextClass: "text-yellow-sun-deep",
    dotColorVar: "var(--yellow-sun)",
    borderColorVar: "var(--yellow-sun)",
  },
} as const;

function getConfig(status: string) {
  if (status === "completed") return STATUS_CONFIG.completed;
  if (status === "abandoned") return STATUS_CONFIG.abandoned;
  return STATUS_CONFIG.active;
}

function QuestSkeleton() {
  return (
    <section className="relative flex-1 overflow-hidden bg-[#F5C542] px-6 py-10">
      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-8 flex items-start justify-between">
          <div className="flex flex-col gap-2">
            <div className="h-9 w-64 animate-pulse rounded-xl bg-black/10" />
            <div className="h-5 w-48 animate-pulse rounded-lg bg-black/10" />
          </div>
          <div className="h-9 w-32 animate-pulse rounded-xl bg-black/10" />
        </div>
        <div className="flex flex-col gap-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-28 animate-pulse rounded-2xl border-2 border-black bg-white shadow-[4px_4px_0_#000]"
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function DayDots({
  missions,
  total,
  completed,
  dotColorVar,
}: {
  missions: QuestMissionSummary[];
  total: number;
  completed: number;
  dotColorVar: string;
}) {
  const count = total || 7;
  return (
    <div className="flex items-center gap-1.5" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => {
        const mission = missions[i];
        const isDone = mission?.status === "completed";
        const isCurrent = !isDone && i === completed;
        return (
          <div
            key={i}
            className="size-2.5 rounded-full transition-colors"
            style={{
              backgroundColor: isDone
                ? dotColorVar
                : isCurrent
                  ? `color-mix(in srgb, ${dotColorVar} 50%, transparent)`
                  : "var(--border)",
            }}
          />
        );
      })}
    </div>
  );
}

function QuestCard({
  quest,
  index,
}: {
  quest: QuestListItem;
  index: number;
}) {
  const cfg = getConfig(quest.status);
  const Icon = cfg.icon;
  const pct =
    quest.totalMissions > 0
      ? Math.round((quest.completedCount / quest.totalMissions) * 100)
      : 0;

  const dateStr = new Date(quest.createdAt).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });

  const statusLabel =
    quest.status === "completed"
      ? m.quest_list_completedQuest()
      : quest.status === "abandoned"
        ? m.quest_list_abandonedQuest()
        : m.quest_list_activeQuest();

  const progressText = m.quest_list_progress({
    completed: quest.completedCount,
    total: quest.totalMissions,
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.07, ease: [0.16, 1, 0.3, 1] }}
    >
      <LocaleLink href={`/quest/${quest.id}`}>
        <div
          className="group relative overflow-hidden rounded-2xl border-2 border-black bg-white p-5 shadow-[4px_4px_0_#000] transition-all hover:-translate-y-0.5 hover:shadow-[6px_6px_0_#000] active:translate-y-0 active:shadow-[2px_2px_0_#000]"
          role="article"
          aria-label={`${quest.dream} — ${statusLabel} — ${progressText}`}
        >
          <div className="flex items-start gap-4">
            {/* Status icon */}
            <div
              className={`mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl border-2 border-black ${cfg.iconBgClass} shadow-[2px_2px_0_#000]`}
            >
              {React.createElement(Icon, {
                size: 18,
                style: { color: cfg.iconColorVar },
                strokeWidth: 1.75,
                "aria-hidden": true,
              })}
            </div>

            {/* Content */}
            <div className="min-w-0 flex-1">
              <h3 className="type-h4 line-clamp-2 leading-snug">{quest.dream}</h3>

              {/* Day dots + count */}
              <div className="mt-2.5 flex items-center gap-3">
                <DayDots
                  missions={quest.missions}
                  total={quest.totalMissions}
                  completed={quest.completedCount}
                  dotColorVar={cfg.dotColorVar}
                />
                <span className="text-xs tabular-nums text-muted-foreground">
                  {progressText}
                </span>
              </div>

              {/* Progress bar */}
              <div
                className="mt-2 h-1 overflow-hidden rounded-full bg-muted"
                role="progressbar"
                aria-valuenow={pct}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <motion.div
                  className="h-full rounded-full"
                  style={{ backgroundColor: cfg.dotColorVar }}
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{
                    duration: 0.9,
                    delay: index * 0.07 + 0.3,
                    ease: [0.16, 1, 0.3, 1],
                  }}
                />
              </div>

              {/* Status chip + date */}
              <div className="mt-2.5 flex items-center gap-2">
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${cfg.badgeBgClass} ${cfg.badgeTextClass}`}
                >
                  {statusLabel}
                </span>
                <span className="text-xs text-muted-foreground">{dateStr}</span>
              </div>
            </div>

            {/* Arrow */}
            {React.createElement(ArrowRight, {
              className: "mt-1 size-5 shrink-0 text-border transition-transform group-hover:translate-x-1",
              "aria-hidden": true,
            })}
          </div>
        </div>
      </LocaleLink>
    </motion.div>
  );
}

function getGreeting(name: string | null): string {
  if (!name) return m.quest_list_greetingGuest();
  const hour = new Date().getHours();
  if (hour < 12) return m.quest_list_greetingMorning({ name });
  if (hour < 17) return m.quest_list_greetingAfternoon({ name });
  return m.quest_list_greetingEvening({ name });
}

export const Route = createFileRoute("/$locale/quest/")({
  loader: async () => {
    try {
      const session = await getAuthSessionFn();
      return { session };
    } catch {
      return { session: { authenticated: false as const } };
    }
  },
  component: QuestListPage,
});

function QuestListPage() {
  const { session } = Route.useLoaderData();
  const router = useLocaleRouter();

  const [quests, setQuests] = useState<QuestListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [childName, setChildName] = useState<string | null>(null);
  const [sessionChildId, setSessionChildId] = useState<string | null>(null);
  const [authState, setAuthState] = useState<
    "loading" | "child" | "parent" | "unauthenticated"
  >("loading");
  useChildId(authState, sessionChildId);

  useEffect(() => {
    // Resolve auth state from loader session
    if (!session.authenticated) {
      setAuthState("unauthenticated");
    } else if (session.mode === "parent") {
      setAuthState("parent");
    } else {
      setAuthState("child");
      setChildName((session as { childName?: string | null }).childName ?? null);
      setSessionChildId((session as { childId?: string | null }).childId ?? null);
    }
  }, [session]);

  useEffect(() => {
    // Wait for auth to resolve before deciding
    if (authState === "loading") return;
    // Only child sessions can fetch quests; parent/unauthenticated → empty state
    if (authState !== "child") {
      setLoading(false);
      return;
    }
    async function fetchQuests() {
      try {
        const result = await listQuestsFn();
        if (!result.ok) {
          if (result.error === "unauthorized") {
            router.push("/login?callbackUrl=/quest");
          }
          return;
        }
        setQuests((result as { ok: true; quests?: QuestListItem[] }).quests ?? []);
      } catch {
        // Non-critical — show empty state
      } finally {
        setLoading(false);
      }
    }
    fetchQuests();
  }, [router, authState]);

  const greeting = getGreeting(childName);

  if (loading) return <QuestSkeleton />;

  return (
    <KidPageShell
      kicker={m.quest_list_kicker()}
      title={greeting}
      subtitle={m.quest_list_greetingSubtitle()}
      actions={
        quests.length > 0 ? (
          <LocaleLink href="/quest/new">
            <Button
              size="sm"
              className="rounded-full border-2 border-black bg-[#C8A4E0] font-black text-black shadow-[3px_3px_0_#000] hover:bg-[#C8A4E0] hover:brightness-95 active:shadow-[1px_1px_0_#000]"
            >
              {React.createElement(Plus, { className: "mr-1.5 size-4" })}
              {m.quest_list_createQuest()}
            </Button>
          </LocaleLink>
        ) : null
      }
    >
      <div className="mx-auto w-full max-w-2xl">
        {quests.length === 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col items-center justify-center rounded-3xl border-2 border-black bg-white px-6 py-16 text-center shadow-[4px_4px_0_#000]"
          >
            <div className="mb-5 flex size-20 items-center justify-center rounded-2xl border-2 border-black bg-[#F5C542] shadow-[2px_2px_0_#000]">
              {React.createElement(Compass, {
                size: 36,
                className: "text-black",
                strokeWidth: 2,
                "aria-hidden": true,
              })}
            </div>
            <h2 className="text-2xl font-black tracking-tight text-black">
              {m.quest_list_empty()}
            </h2>
            <p className="mt-2 max-w-xs text-sm font-semibold text-black/65">
              {m.quest_list_emptyDesc()}
            </p>
            <div className="mt-6 flex flex-col gap-2 sm:flex-row">
              <LocaleLink href="/discover">
                <Button
                  size="lg"
                  className="rounded-full border-2 border-black bg-[#A8C8F0] font-black text-black shadow-[3px_3px_0_#000] hover:bg-[#A8C8F0] hover:brightness-95 active:shadow-[1px_1px_0_#000]"
                >
                  {React.createElement(Map, { className: "mr-2 size-4" })}
                  {m.quest_list_startFirst()}
                </Button>
              </LocaleLink>
              <LocaleLink href="/quest/new">
                <Button
                  size="lg"
                  variant="outline"
                  className="rounded-full border-2 border-black bg-white font-black text-black shadow-[3px_3px_0_#000] hover:bg-white hover:brightness-95 active:shadow-[1px_1px_0_#000]"
                >
                  {React.createElement(Plus, { className: "mr-2 size-4" })}
                  {m.quest_list_createQuest()}
                </Button>
              </LocaleLink>
            </div>
          </motion.div>
        )}

        {quests.length > 0 && (
          <div className="flex flex-col gap-3">
            {quests.map((quest, idx) => (
              <QuestCard key={quest.id} quest={quest} index={idx} />
            ))}
          </div>
        )}
      </div>
    </KidPageShell>
  );
}
