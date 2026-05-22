"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { useTranslations } from "next-intl";
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
import { Link, useRouter } from "@/i18n/navigation";
import { useChildId } from "@/hooks/use-child-id";

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
    <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:py-12">
      <div className="mb-8 flex items-start justify-between">
        <div className="flex flex-col gap-2">
          <div className="h-9 w-64 animate-pulse rounded-xl bg-muted" />
          <div className="h-5 w-48 animate-pulse rounded-lg bg-muted" />
        </div>
        <div className="h-9 w-32 animate-pulse rounded-xl bg-muted" />
      </div>
      <div className="flex flex-col gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-28 animate-pulse rounded-2xl bg-muted" />
        ))}
      </div>
    </div>
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
        const m = missions[i];
        const isDone = m?.status === "completed";
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
  t,
}: {
  quest: QuestListItem;
  index: number;
  t: ReturnType<typeof useTranslations>;
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
      ? t("completedQuest")
      : quest.status === "abandoned"
        ? t("abandonedQuest")
        : t("activeQuest");

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.07, ease: [0.16, 1, 0.3, 1] }}
    >
      <Link href={`/quest/${quest.id}`}>
        <div
          className="group relative overflow-hidden rounded-2xl bg-card p-5 transition-shadow hover:shadow-sm"
          style={{ border: `1.5px solid ${cfg.borderColorVar}` }}
          role="article"
          aria-label={`${quest.dream} — ${statusLabel} — ${t("progress", { completed: quest.completedCount, total: quest.totalMissions })}`}
        >
          <div className="flex items-start gap-4">
            {/* Status icon */}
            <div
              className={`mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl ${cfg.iconBgClass}`}
            >
              <Icon
                size={18}
                style={{ color: cfg.iconColorVar }}
                strokeWidth={1.75}
                aria-hidden="true"
              />
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
                  {t("progress", {
                    completed: quest.completedCount,
                    total: quest.totalMissions,
                  })}
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
            <ArrowRight
              className="mt-1 size-5 shrink-0 text-border transition-transform group-hover:translate-x-1"
              aria-hidden="true"
            />
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

function useGreeting(name: string | null, t: ReturnType<typeof useTranslations>) {
  const [greeting, setGreeting] = useState<string>("");

  useEffect(() => {
    const hour = new Date().getHours();
    if (!name) {
      setGreeting(t("greetingGuest"));
      return;
    }
    if (hour < 12) setGreeting(t("greetingMorning", { name }));
    else if (hour < 17) setGreeting(t("greetingAfternoon", { name }));
    else setGreeting(t("greetingEvening", { name }));
  }, [name, t]);

  return greeting;
}

export default function QuestListPage() {
  const t = useTranslations("quest.list");
  const router = useRouter();

  const [quests, setQuests] = useState<QuestListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [childName, setChildName] = useState<string | null>(null);
  const [sessionChildId, setSessionChildId] = useState<string | null>(null);
  const [authState, setAuthState] = useState<
    "loading" | "child" | "parent" | "unauthenticated"
  >("loading");
  useChildId(authState, sessionChildId);

  useEffect(() => {
    async function fetchData() {
      try {
        const [questRes, sessionRes] = await Promise.all([
          fetch("/api/quest/list"),
          fetch("/api/auth/session"),
        ]);
        if (!questRes.ok) {
          if (questRes.status === 401) {
            router.push("/login?callbackUrl=/quest");
          }
          return;
        }
        const data = await questRes.json();
        setQuests(data.quests ?? []);
        if (sessionRes.ok) {
          const session = await sessionRes.json();
          setChildName(session.childName ?? null);
          setSessionChildId(session.childId ?? null);
          if (session.authenticated) {
            setAuthState(session.type === "child" ? "child" : "parent");
          } else {
            setAuthState("unauthenticated");
          }
        }
      } catch {
        // Non-critical — show empty state
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [router]);

  const greeting = useGreeting(childName, t);

  if (loading) return <QuestSkeleton />;

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:py-12">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        className="mb-8 flex items-start justify-between gap-4"
      >
        <div>
          <h1 className="type-h2">{greeting}</h1>
          <p className="type-lede mt-1">{t("greetingSubtitle")}</p>
        </div>

        {quests.length > 0 && (
          <Link href="/quest/new" className="shrink-0 pt-2">
            <Button size="sm">
              <Plus className="mr-1.5 size-4" />
              {t("createQuest")}
            </Button>
          </Link>
        )}
      </motion.div>

      {/* Empty state */}
      {quests.length === 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-border bg-muted px-6 py-16 text-center"
        >
          <div className="mb-5 flex size-20 items-center justify-center rounded-2xl bg-general-surface">
            <Compass
              size={36}
              style={{ color: "var(--yellow-sun-deep)" }}
              strokeWidth={1.5}
              aria-hidden="true"
            />
          </div>
          <h2 className="type-h3">{t("empty")}</h2>
          <p className="type-lede mt-2 max-w-xs">{t("emptyDesc")}</p>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            <Link href="/discover">
              <Button size="lg">
                <Map className="mr-2 size-4" />
                {t("startFirst")}
              </Button>
            </Link>
            <Link href="/quest/new">
              <Button variant="outline" size="lg">
                <Plus className="mr-2 size-4" />
                {t("createQuest")}
              </Button>
            </Link>
          </div>
        </motion.div>
      )}

      {/* Quest list */}
      {quests.length > 0 && (
        <div className="flex flex-col gap-3">
          {quests.map((quest, idx) => (
            <QuestCard key={quest.id} quest={quest} index={idx} t={t} />
          ))}
        </div>
      )}
    </div>
  );
}
