import { getTranslations } from "next-intl/server";
import { getUserSession } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { verifyParentChildLink } from "@/lib/parent/link";
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

  const quest = await prisma.quest.findUnique({
    where: { id: questId },
    include: {
      child: { select: { id: true, name: true } },
      missions: { orderBy: { day: "asc" } },
    },
  });

  if (!quest) notFound();

  const isLinked = await verifyParentChildLink(session.userId, quest.childId);
  if (!isLinked) notFound();

  await prisma.parentQuestFollow.upsert({
    where: {
      parentId_questId: { parentId: session.userId, questId },
    },
    update: { lastViewedAt: new Date() },
    create: {
      parentId: session.userId,
      childId: quest.childId,
      questId,
    },
  });

  const currentMission =
    quest.missions.find(
      (m) => m.status === "in_progress" || m.status === "available",
    ) ?? quest.missions[quest.missions.length - 1];

  const completedCount = quest.missions.filter(
    (m) => m.status === "completed",
  ).length;

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
