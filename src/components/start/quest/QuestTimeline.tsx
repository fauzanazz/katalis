import { m } from "@/paraglide/messages";
import {
  Lock,
  Play,
  Sparkles,
  Star,
  Check,
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

type StatusKey = "locked" | "available" | "in_progress" | "completed";

const stampStyle: Record<StatusKey, string> = {
  locked: "bg-[color:var(--muted)] text-[color:var(--muted-foreground)]",
  available: "bg-[color:var(--blue-ocean-light)] text-white",
  in_progress: "bg-[color:var(--yellow-sun)] text-[color:var(--ink)]",
  completed: "bg-[color:var(--green-leaf-deep)] text-white",
};

function StampGlyph({ status }: { status: StatusKey }) {
  if (status === "locked")
    return <Lock className="size-5" aria-hidden="true" />;
  if (status === "available")
    return <Play className="size-5 fill-current" aria-hidden="true" />;
  if (status === "in_progress")
    return <Sparkles className="size-5" aria-hidden="true" />;
  return <Check className="size-6" aria-hidden="true" strokeWidth={3} />;
}

const getStatusLabel = (status: string) => {
  switch (status) {
    case "locked":
      return m.quest_overview_statusLocked();
    case "available":
      return m.quest_overview_statusAvailable();
    case "in_progress":
      return m.quest_overview_statusInProgress();
    case "completed":
      return m.quest_overview_statusCompleted();
    default:
      return status;
  }
};

export function QuestTimeline({
  missions,
  selectedDay,
  onSelectDay,
  completedCount,
  totalMissions,
}: QuestTimelineProps) {
  const progressPercent =
    totalMissions > 0 ? Math.round((completedCount / totalMissions) * 100) : 0;

  return (
    <div className="flex flex-col gap-5">
      {/* XP-style progress rail */}
      <div className="sticker-card relative px-4 pb-3 pt-4">
        <span
          aria-hidden="true"
          className="tape-strip left-1/2 top-[-9px] -translate-x-1/2 rotate-[-3deg] rounded-[2px]"
        />
        <div className="mb-2 flex items-end justify-between">
          <span
            className="text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--ink)]"
            style={{ fontFamily: "var(--font-montserrat)" }}
          >
            {m.quest_overview_progressLabel()}
          </span>
          <span
            className="text-lg leading-none text-[color:var(--yellow-sun-deep)]"
            style={{ fontFamily: "var(--font-luckiest-guy)" }}
            aria-hidden="true"
          >
            {progressPercent}%
          </span>
        </div>
        <div
          className="relative h-5 w-full overflow-hidden rounded-full border-2 border-[color:var(--ink)] bg-[#fffdf6]"
          role="progressbar"
          aria-valuenow={progressPercent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={m.quest_overview_progressPercent({ percent: progressPercent })}
        >
          <div
            className="relative h-full rounded-full bg-gradient-to-r from-[color:var(--yellow-sun)] to-[color:var(--green-leaf-deep)] transition-[width] duration-700 ease-out"
            style={{ width: `${progressPercent}%` }}
          >
            {progressPercent > 0 && progressPercent < 100 && (
              <Star
                className="absolute right-[-6px] top-1/2 size-4 -translate-y-1/2 fill-[color:var(--yellow-sun-deep)] text-[color:var(--ink)]"
                strokeWidth={1.5}
                aria-hidden="true"
              />
            )}
          </div>
        </div>
        <p className="mt-2 text-center text-sm text-[color:var(--muted-foreground)]">
          {m.quest_overview_progressValue({
            completed: completedCount,
            total: totalMissions,
          })}
        </p>
      </div>

      {/* Quest map */}
      <nav aria-label={m.quest_overview_timeline()}>
        <ol
          role="list"
          className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-2"
        >
          {missions.map((mission, idx) => {
            const status = (mission.status as StatusKey) ?? "locked";
            const isLocked = status === "locked";
            const isSelected = selectedDay === mission.day;
            const isClickable = !isLocked;

            return (
              <li
                key={mission.day}
                className="relative flex flex-col items-center text-center animate-pop-in"
                style={{ animationDelay: `${Math.min(idx * 60, 360)}ms` }}
              >
                <button
                  type="button"
                  onClick={() => {
                    if (isClickable) onSelectDay(mission.day);
                  }}
                  disabled={isLocked}
                  className={`group relative flex w-full flex-col items-center gap-2 rounded-2xl px-2 py-3 transition-transform duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--background)] ${
                    isClickable
                      ? "cursor-pointer active:scale-[0.96]"
                      : "cursor-not-allowed"
                  }`}
                  aria-label={`${m.quest_overview_dayLabel({ day: mission.day })}: ${mission.title} - ${getStatusLabel(status)}`}
                  aria-current={isSelected ? "step" : undefined}
                  aria-disabled={isLocked}
                  tabIndex={isLocked ? -1 : 0}
                >
                  {/* Stamp medallion */}
                  <span
                    className={`relative flex size-16 items-center justify-center rounded-full border-[3px] border-[color:var(--ink)] ${
                      stampStyle[status]
                    } ${isLocked ? "opacity-70" : ""} ${
                      isSelected
                        ? "scale-110 shadow-[3px_4px_0_0_var(--ink)]"
                        : "shadow-[2px_3px_0_0_var(--ink)]"
                    } ${
                      status === "available" || status === "in_progress"
                        ? "animate-pulse-ring"
                        : ""
                    } transition-transform group-hover:-translate-y-0.5`}
                  >
                    <span className="absolute inset-0 flex items-center justify-center">
                      <StampGlyph status={status} />
                    </span>
                    {/* Day number plaque */}
                    <span
                      className="absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-md border-2 border-[color:var(--ink)] bg-[#fffdf6] px-1.5 text-[10px] font-black leading-none"
                      style={{ fontFamily: "var(--font-montserrat)" }}
                    >
                      {m.quest_overview_dayLabel({ day: mission.day })}
                    </span>
                    {isSelected && (
                      <span
                        aria-hidden="true"
                        className="pointer-events-none absolute -right-3 -top-3 rotate-12 rounded-full border-2 border-[color:var(--ink)] bg-[color:var(--pink-bloom)] px-2 py-0.5 text-[9px] font-black uppercase text-white shadow-[1px_1px_0_var(--ink)]"
                        style={{ fontFamily: "var(--font-montserrat)" }}
                      >
                        Here!
                      </span>
                    )}
                  </span>

                  {/* Title strip */}
                  <span
                    className={`mt-2 line-clamp-2 max-w-[12ch] text-xs font-bold leading-snug ${
                      isLocked
                        ? "text-[color:var(--muted-foreground)]"
                        : "text-[color:var(--ink)]"
                    }`}
                  >
                    {mission.title}
                  </span>

                  {/* Status tag */}
                  <span
                    className={`mt-0.5 inline-flex items-center rounded-full border-2 border-[color:var(--ink)] px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${
                      status === "completed"
                        ? "bg-[color:var(--green-leaf-light)] text-[color:var(--ink)]"
                        : status === "in_progress"
                          ? "bg-[color:var(--yellow-sun-light)] text-[color:var(--ink)]"
                          : status === "available"
                            ? "bg-[color:var(--blue-ocean-light)] text-white"
                            : "bg-[color:var(--muted)] text-[color:var(--muted-foreground)]"
                    }`}
                    style={{ fontFamily: "var(--font-montserrat)" }}
                  >
                    {getStatusLabel(status)}
                  </span>
                </button>

                {/* Trail dots between days (not on the last) */}
                {idx < missions.length - 1 && (
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute -right-2 top-8 hidden -translate-y-1/2 items-center gap-1 lg:hidden"
                  >
                    <span className="size-1.5 rounded-full bg-[color:var(--ink)] opacity-50" />
                    <span className="size-1.5 rounded-full bg-[color:var(--ink)] opacity-50" />
                    <span className="size-1.5 rounded-full bg-[color:var(--ink)] opacity-50" />
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
    </div>
  );
}
