"use client";

import { useTranslations } from "next-intl";
import {
  Lock,
  PlayCircle,
  CheckCircle2,
  Circle,
  Loader2,
} from "lucide-react";

export interface MissionSummary {
  id: string;
  day: number;
  title: string;
  status: string;
}

interface QuestTimelineProps {
  missions: MissionSummary[];
  selectedDay: number | null;
  onSelectDay: (day: number) => void;
  completedCount: number;
  totalMissions: number;
}

const statusConfig: Record<
  string,
  {
    iconKey: string;
    colorClasses: string;
    bgClasses: string;
    borderClasses: string;
  }
> = {
  locked: {
    iconKey: "locked",
    colorClasses: "text-zinc-400",
    bgClasses: "bg-zinc-100",
    borderClasses: "border-zinc-200",
  },
  available: {
    iconKey: "available",
    colorClasses: "text-blue-600",
    bgClasses: "bg-blue-50",
    borderClasses: "border-blue-300",
  },
  in_progress: {
    iconKey: "in_progress",
    colorClasses: "text-amber-600",
    bgClasses: "bg-amber-50",
    borderClasses: "border-amber-300",
  },
  completed: {
    iconKey: "completed",
    colorClasses: "text-green-600",
    bgClasses: "bg-green-50",
    borderClasses: "border-green-300",
  },
};

function StatusIcon({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  switch (status) {
    case "locked":
      return <Lock className={className} aria-hidden="true" />;
    case "available":
      return <PlayCircle className={className} aria-hidden="true" />;
    case "in_progress":
      return <Loader2 className={className} aria-hidden="true" />;
    case "completed":
      return <CheckCircle2 className={className} aria-hidden="true" />;
    default:
      return <Circle className={className} aria-hidden="true" />;
  }
}

export function QuestTimeline({
  missions,
  selectedDay,
  onSelectDay,
  completedCount,
  totalMissions,
}: QuestTimelineProps) {
  const t = useTranslations("quest.overview");

  const progressPercent =
    totalMissions > 0 ? Math.round((completedCount / totalMissions) * 100) : 0;

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "locked":
        return t("statusLocked");
      case "available":
        return t("statusAvailable");
      case "in_progress":
        return t("statusInProgress");
      case "completed":
        return t("statusCompleted");
      default:
        return status;
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Progress indicator */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-medium text-foreground">
            {t("progressLabel")}
          </span>
          <span className="text-muted-foreground">
            {t("progressValue", {
              completed: completedCount,
              total: totalMissions,
            })}
          </span>
        </div>
        <div
          className="h-3 w-full overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuenow={progressPercent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={t("progressPercent", { percent: progressPercent })}
        >
          <div
            className="h-full rounded-full bg-gradient-to-r from-blue-500 to-green-500 transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Timeline */}
      <nav aria-label={t("timeline")}>
        <ol className="flex flex-col gap-2" role="list">
          {missions.map((mission) => {
            const config = statusConfig[mission.status] ?? statusConfig.locked;
            const isLocked = mission.status === "locked";
            const isSelected = selectedDay === mission.day;
            const isClickable = !isLocked;

            return (
              <li key={mission.day}>
                <button
                  type="button"
                  onClick={() => {
                    if (isClickable) {
                      onSelectDay(mission.day);
                    }
                  }}
                  disabled={isLocked}
                  className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-all ${
                    config.borderClasses
                  } ${config.bgClasses} ${
                    isSelected
                      ? "ring-2 ring-blue-500 ring-offset-1"
                      : ""
                  } ${
                    isClickable
                      ? "cursor-pointer hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                      : "cursor-not-allowed opacity-70"
                  }`}
                  aria-label={`${t("dayLabel", { day: mission.day })}: ${mission.title} - ${getStatusLabel(mission.status)}`}
                  aria-current={isSelected ? "step" : undefined}
                  aria-disabled={isLocked}
                  tabIndex={isLocked ? -1 : 0}
                >
                  {/* Day indicator */}
                  <div
                    className={`flex size-10 shrink-0 items-center justify-center rounded-full ${config.bgClasses} ${config.colorClasses} border ${config.borderClasses}`}
                  >
                    <StatusIcon
                      status={mission.status}
                      className="size-5"
                    />
                  </div>

                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs font-semibold uppercase tracking-wide ${config.colorClasses}`}
                      >
                        {t("dayLabel", { day: mission.day })}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${config.bgClasses} ${config.colorClasses}`}
                      >
                        {getStatusLabel(mission.status)}
                      </span>
                    </div>
                    <p
                      className={`mt-0.5 truncate text-sm font-medium ${
                        isLocked
                          ? "text-zinc-400"
                          : "text-ink"
                      }`}
                    >
                      {mission.title}
                    </p>
                  </div>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>
    </div>
  );
}
