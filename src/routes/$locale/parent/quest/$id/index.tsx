"use client";

import { useEffect } from "react";
import {
  createFileRoute,
  notFound,
  redirect,
} from "@tanstack/react-router";
import {
  CheckCircle2,
  Lock,
  PlayCircle,
  Lightbulb,
  Heart,
  MessageCircle,
} from "lucide-react";
import { m } from "@/paraglide/messages";
import {
  getParentQuestDetailFn,
  markQuestFollowedFn,
} from "@/lib/server/parent-interests";
import { MissionInterestRating } from "@/components/start/parent/MissionInterestRating";

export const Route = createFileRoute("/$locale/parent/quest/$id/")({
  loader: async ({ params }) => {
    const res = await getParentQuestDetailFn({ data: { id: params.id } });
    if (!res.ok) {
      if (res.error === "unauthorized") {
        throw redirect({ href: `/${params.locale}/login` });
      }
      if (res.error === "not_found" || res.error === "forbidden") {
        throw notFound();
      }
      throw notFound();
    }
    return {
      quest: res.quest,
      currentMission: res.currentMission,
      completedCount: res.completedCount,
      topInterestKey: res.topInterestKey,
    };
  },
  component: ParentQuestViewPage,
});

function ParentQuestViewPage() {
  const { quest, currentMission, completedCount, topInterestKey } =
    Route.useLoaderData();
  const { id: questId } = Route.useParams();

  useEffect(() => {
    void markQuestFollowedFn({ data: { questId } });
  }, [questId]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <header className="mb-8">
        <p className="text-sm text-muted-foreground">
          {quest.child.name ?? m.parent_quest_childQuest()}
        </p>
        <h1 className="text-2xl font-bold text-foreground">{quest.dream}</h1>
        <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
          <span>
            {completedCount}/7 {m.parent_quest_daysCompleted()}
          </span>
          {quest.status === "completed" && (
            <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
              {m.parent_quest_completed()}
            </span>
          )}
        </div>
      </header>

      {/* Progress timeline */}
      <div className="mb-8 flex gap-2">
        {quest.missions.map((mission) => {
          const isComplete = mission.status === "completed";
          const isCurrent = mission.id === currentMission?.id;
          const isLocked = mission.status === "locked";

          return (
            <div
              key={mission.id}
              className={`flex size-10 items-center justify-center rounded-full border-2 transition-colors ${
                isComplete
                  ? "border-green-500 bg-green-50"
                  : isCurrent
                    ? "border-amber-500 bg-amber-50"
                    : "border-border bg-muted"
              }`}
              title={`${m.parent_quest_day()} ${mission.day}`}
            >
              {isComplete ? (
                <CheckCircle2 className="size-5 text-green-600" />
              ) : isLocked ? (
                <Lock className="size-4 text-muted-foreground" />
              ) : isCurrent ? (
                <PlayCircle className="size-5 text-amber-600" />
              ) : (
                <span className="text-sm font-semibold">{mission.day}</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Current mission for parent */}
      {currentMission && (
        <section className="mb-6 rounded-xl border border-border/60 bg-background p-6">
          <h2 className="mb-4 text-lg font-semibold">
            {m.parent_quest_day()} {currentMission.day}: {currentMission.title}
          </h2>
          <p className="mb-4 text-muted-foreground">
            {currentMission.description}
          </p>

          {currentMission.materials && (
            <div className="mb-4">
              <h3 className="mb-2 text-sm font-medium">
                {m.parent_quest_materialsNeeded()}
              </h3>
              <div className="flex flex-wrap gap-2">
                {(JSON.parse(currentMission.materials) as string[]).map(
                  (material, i) => (
                    <span
                      key={i}
                      className="rounded-full bg-muted px-3 py-1 text-sm"
                    >
                      {material}
                    </span>
                  ),
                )}
              </div>
            </div>
          )}

          <div className="border-t pt-4">
            <p className="mb-2 text-sm font-medium text-foreground">
              Rate interest for this mission
            </p>
            <MissionInterestRating
              childId={quest.child.id}
              missionId={currentMission.id}
              interestKey={topInterestKey}
            />
          </div>
        </section>
      )}

      {/* Parent support tips */}
      <section className="rounded-xl border border-amber-200 bg-amber-50 p-6">
        <h3 className="mb-4 flex items-center gap-2 font-semibold text-amber-900">
          <Lightbulb className="size-5" />
          {m.parent_quest_howToSupport()}
        </h3>
        <ul className="space-y-3">
          <li className="flex items-start gap-3">
            <Heart className="mt-0.5 size-4 shrink-0 text-amber-600" />
            <span className="text-sm text-amber-800">
              {m.parent_quest_supportTip1()}
            </span>
          </li>
          <li className="flex items-start gap-3">
            <MessageCircle className="mt-0.5 size-4 shrink-0 text-amber-600" />
            <span className="text-sm text-amber-800">
              {m.parent_quest_supportTip2()}
            </span>
          </li>
          <li className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-amber-600" />
            <span className="text-sm text-amber-800">
              {m.parent_quest_supportTip3()}
            </span>
          </li>
        </ul>
      </section>
    </div>
  );
}
