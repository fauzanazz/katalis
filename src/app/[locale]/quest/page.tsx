"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Sparkles,
  ArrowRight,
  Trophy,
  Clock,
  XCircle,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

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

export default function QuestListPage() {
  const t = useTranslations("quest.list");

  const [quests, setQuests] = useState<QuestListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchQuests() {
      try {
        const res = await fetch("/api/quest/list");
        if (!res.ok) return;
        const data = await res.json();
        setQuests(data.quests ?? []);
      } catch {
        // Non-critical — show empty state
      } finally {
        setLoading(false);
      }
    }
    fetchQuests();
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <Trophy className="size-5 text-green-500" aria-hidden="true" />;
      case "abandoned":
        return (
          <XCircle className="size-5 text-zinc-400" aria-hidden="true" />
        );
      default:
        return <Clock className="size-5 text-blue-500" aria-hidden="true" />;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "completed":
        return t("completedQuest");
      case "abandoned":
        return t("abandonedQuest");
      default:
        return t("activeQuest");
    }
  };

  if (loading) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col items-center justify-center px-4 py-16">
        <div className="size-12 animate-spin rounded-full border-4 border-zinc-200 border-t-blue-500" />
        <p className="mt-4 text-zinc-600 dark:text-zinc-400">
          {t("title")}...
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:py-12">
      {/* Header */}
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl dark:text-zinc-50">
          {t("title")}
        </h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          {t("subtitle")}
        </p>
      </div>

      {/* Empty state */}
      {quests.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-zinc-200 bg-zinc-50 px-6 py-16 text-center dark:border-zinc-700 dark:bg-zinc-900/50">
          <div className="mb-4 flex size-20 items-center justify-center rounded-full bg-gradient-to-r from-purple-100 to-blue-100 dark:from-purple-900/30 dark:to-blue-900/30">
            <Sparkles className="size-10 text-purple-600 dark:text-purple-400" />
          </div>
          <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
            {t("empty")}
          </h2>
          <p className="mt-2 max-w-md text-zinc-600 dark:text-zinc-400">
            {t("emptyDesc")}
          </p>
          <Link href="/discover">
            <Button size="lg" className="mt-6">
              <Sparkles className="mr-2 size-5" />
              {t("startFirst")}
            </Button>
          </Link>
        </div>
      )}

      {/* Quest list */}
      {quests.length > 0 && (
        <div className="flex flex-col gap-4">
          {quests.map((quest) => {
            const progressPercent =
              quest.totalMissions > 0
                ? Math.round(
                    (quest.completedCount / quest.totalMissions) * 100,
                  )
                : 0;

            return (
              <Link key={quest.id} href={`/quest/${quest.id}`}>
                <div
                  className="group rounded-xl border border-zinc-200 bg-white p-5 shadow-sm transition-all hover:border-blue-300 hover:shadow-md dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-blue-600"
                  role="article"
                  aria-label={`${quest.dream} - ${getStatusLabel(quest.status)} - ${t("progress", { completed: quest.completedCount, total: quest.totalMissions })}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    {/* Left content */}
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800">
                        {getStatusIcon(quest.status)}
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-semibold text-zinc-900 dark:text-zinc-50">
                          {quest.dream}
                        </h3>
                        <div className="mt-1 flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                              quest.status === "completed"
                                ? "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                : quest.status === "abandoned"
                                  ? "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                                  : "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                            }`}
                          >
                            {getStatusLabel(quest.status)}
                          </span>
                          <span>·</span>
                          <span>
                            {t("progress", {
                              completed: quest.completedCount,
                              total: quest.totalMissions,
                            })}
                          </span>
                        </div>

                        {/* Progress bar */}
                        <div
                          className="mt-2 h-2 w-full max-w-[200px] overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800"
                          role="progressbar"
                          aria-valuenow={progressPercent}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-label={`${progressPercent}%`}
                        >
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              quest.status === "completed"
                                ? "bg-green-500"
                                : "bg-gradient-to-r from-blue-500 to-green-500"
                            }`}
                            style={{ width: `${progressPercent}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Arrow */}
                    <ArrowRight className="size-5 shrink-0 text-zinc-400 transition-transform group-hover:translate-x-1 dark:text-zinc-500" />
                  </div>
                </div>
              </Link>
            );
          })}

          {/* Create new quest */}
          <div className="mt-4 flex justify-center">
            <Link href="/quest/new">
              <Button variant="outline" size="lg">
                <Plus className="mr-2 size-5" />
                {t("createQuest")}
              </Button>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
