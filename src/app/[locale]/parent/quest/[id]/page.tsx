import { getTranslations } from "next-intl/server";
import { getUserSession } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db";
import { quests, parentQuestFollows } from "@/lib/schema";
import { eq, and } from "drizzle-orm";
import { verifyParentChildLink } from "@/lib/parent/link";
import { mapQuestToInterestSignals } from "@/lib/interests/quest-mapper";
import { MissionInterestRating } from "@/components/parent/MissionInterestRating";
import {
  CheckCircle2,
  Lock,
  PlayCircle,
  Lightbulb,
  Heart,
  MessageCircle,
} from "lucide-react";

export default async function ParentQuestViewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getUserSession();
  if (!session) redirect("/login");

  const t = await getTranslations("parent.quest");
  const { id: questId } = await params;

  const quest = await db.query.quests.findFirst({
    where: eq(quests.id, questId),
    with: {
      child: { columns: { id: true, name: true } },
      missions: { orderBy: (m, { asc }) => asc(m.day) },
      discovery: { columns: { detectedTalents: true } },
    },
  });

  if (quest == null) notFound();

  const isLinked = await verifyParentChildLink(session.userId, quest.childId);
  if (!isLinked) notFound();

  await db
    .insert(parentQuestFollows)
    .values({ parentId: session.userId, childId: quest.childId, questId })
    .onConflictDoUpdate({
      target: [parentQuestFollows.parentId, parentQuestFollows.questId],
      set: { lastViewedAt: new Date() },
    });

  const currentMission =
    quest.missions.find(
      (m) => m.status === "in_progress" || m.status === "available",
    ) ?? quest.missions[quest.missions.length - 1];

  const completedCount = quest.missions.filter(
    (m) => m.status === "completed",
  ).length;

  let detectedTalents: Array<{ name: string; confidence?: number }> = [];
  if (quest.discovery?.detectedTalents) {
    try {
      detectedTalents = JSON.parse(quest.discovery.detectedTalents);
    } catch {
      detectedTalents = [];
    }
  }

  const mappedSignals = mapQuestToInterestSignals({
    dream: quest.dream,
    localContext: quest.localContext,
    talents: detectedTalents,
  });
  const topInterestKey = mappedSignals[0]?.interestKey ?? "science";

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <header className="mb-8">
        <p className="text-sm text-muted-foreground">
          {quest.child.name ?? t("childQuest")}
        </p>
        <h1 className="text-2xl font-bold text-foreground">{quest.dream}</h1>
        <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
          <span>
            {completedCount}/7 {t("daysCompleted")}
          </span>
          {quest.status === "completed" && (
            <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
              {t("completed")}
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
              title={`${t("day")} ${mission.day}`}
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
            {t("day")} {currentMission.day}: {currentMission.title}
          </h2>
          <p className="mb-4 text-muted-foreground">
            {currentMission.description}
          </p>

          {currentMission.materials && (
            <div className="mb-4">
              <h3 className="mb-2 text-sm font-medium">
                {t("materialsNeeded")}
              </h3>
              <div className="flex flex-wrap gap-2">
                {JSON.parse(currentMission.materials).map(
                  (m: string, i: number) => (
                    <span
                      key={i}
                      className="rounded-full bg-muted px-3 py-1 text-sm"
                    >
                      {m}
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
          {t("howToSupport")}
        </h3>
        <ul className="space-y-3">
          <li className="flex items-start gap-3">
            <Heart className="mt-0.5 size-4 shrink-0 text-amber-600" />
            <span className="text-sm text-amber-800">{t("supportTip1")}</span>
          </li>
          <li className="flex items-start gap-3">
            <MessageCircle className="mt-0.5 size-4 shrink-0 text-amber-600" />
            <span className="text-sm text-amber-800">{t("supportTip2")}</span>
          </li>
          <li className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-amber-600" />
            <span className="text-sm text-amber-800">{t("supportTip3")}</span>
          </li>
        </ul>
      </section>
    </div>
  );
}
