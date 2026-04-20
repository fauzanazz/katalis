"use client";

import { useTranslations } from "next-intl";
import {
  BookOpen,
  ListOrdered,
  Package,
  Lightbulb,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { MissionActions } from "@/components/quest/MissionActions";
import { MissionChat } from "@/components/quest/MissionChat";
import { ReflectionCard } from "@/components/quest/ReflectionCard";
import type { EarnedBadge } from "@/lib/badges";

export interface MissionData {
  id: string;
  day: number;
  title: string;
  description: string;
  instructions: string[];
  materials: string[];
  tips: string[];
  status: string;
  proofPhotoUrl: string | null;
}

interface MissionDetailProps {
  mission: MissionData;
  questId?: string;
  onStatusChange?: () => void;
  readOnly?: boolean;
  onBadgesEarned?: (badges: EarnedBadge[]) => void;
}

export function MissionDetail({
  mission,
  questId,
  onStatusChange,
  readOnly = false,
  onBadgesEarned,
}: MissionDetailProps) {
  const t = useTranslations("quest.overview");

  const isCompleted = mission.status === "completed";
  const isInProgress = mission.status === "in_progress";

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <div className="mb-1 flex items-center gap-2">
          <span className="text-sm font-semibold uppercase tracking-wide text-blue-600">
            {t("dayLabel", { day: mission.day })}
          </span>
          {isCompleted && (
            <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
              <CheckCircle2 className="size-3" aria-hidden="true" />
              {t("statusCompleted")}
            </span>
          )}
          {isInProgress && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
              <Loader2 className="size-3" aria-hidden="true" />
              {t("statusInProgress")}
            </span>
          )}
        </div>
        <h2 className="text-2xl font-bold text-ink">
          {mission.title}
        </h2>
      </div>

      {/* Description */}
      <section aria-labelledby="mission-description">
        <h3
          id="mission-description"
          className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground"
        >
          <BookOpen className="size-4" aria-hidden="true" />
          {t("description")}
        </h3>
        <p className="leading-relaxed text-muted-foreground">
          {mission.description}
        </p>
      </section>

      {/* Instructions */}
      {mission.instructions.length > 0 && (
        <section aria-labelledby="mission-instructions">
          <h3
            id="mission-instructions"
            className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground"
          >
            <ListOrdered className="size-4" aria-hidden="true" />
            {t("instructions")}
          </h3>
          <ol className="flex flex-col gap-2" role="list">
            {mission.instructions.map((step, index) => (
              <li
                key={index}
                className="flex gap-3 rounded-lg border border-border/60 bg-muted p-3"
              >
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
                  {index + 1}
                </span>
                <span className="text-sm leading-relaxed text-foreground">
                  {step}
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* Materials */}
      <section aria-labelledby="mission-materials">
        <h3
          id="mission-materials"
          className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground"
        >
          <Package className="size-4" aria-hidden="true" />
          {t("materials")}
        </h3>
        {mission.materials.length > 0 ? (
          <ul className="flex flex-wrap gap-2" role="list">
            {mission.materials.map((material, index) => (
              <li
                key={index}
                className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-sm text-amber-800"
              >
                {material}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm italic text-zinc-400">
            {t("noMaterials")}
          </p>
        )}
      </section>

      {/* Tips */}
      <section aria-labelledby="mission-tips">
        <h3
          id="mission-tips"
          className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground"
        >
          <Lightbulb className="size-4" aria-hidden="true" />
          {t("tips")}
        </h3>
        {mission.tips.length > 0 ? (
          <ul className="flex flex-col gap-2" role="list">
            {mission.tips.map((tip, index) => (
              <li
                key={index}
                className="flex gap-2 rounded-lg border border-purple-100 bg-purple-50 p-3 text-sm text-purple-800"
              >
                <Lightbulb
                  className="mt-0.5 size-4 shrink-0"
                  aria-hidden="true"
                />
                <span className="leading-relaxed">{tip}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm italic text-zinc-400">
            {t("noTips")}
          </p>
        )}
      </section>

      {/* Mentor chat — only for in-progress missions */}
      {isInProgress && questId && (
        <MissionChat
          questId={questId}
          missionId={mission.id}
          missionDay={mission.day}
          missionTitle={mission.title}
        />
      )}

      {/* Daily reflection — only for completed missions */}
      {isCompleted && questId && (
        <ReflectionCard
          questId={questId}
          missionDay={mission.day}
        />
      )}

      {/* Mission actions (start, complete, proof upload) */}
      {!readOnly && questId && onStatusChange && (
        <MissionActions
          questId={questId}
          missionId={mission.id}
          missionDay={mission.day}
          missionTitle={mission.title}
          status={mission.status}
          proofPhotoUrl={mission.proofPhotoUrl}
          onStatusChange={onStatusChange}
          onBadgesEarned={onBadgesEarned}
        />
      )}

      {/* Read-only proof photo for completed missions without actions */}
      {readOnly && isCompleted && mission.proofPhotoUrl && (
        <section aria-labelledby="mission-proof">
          <h3
            id="mission-proof"
            className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground"
          >
            <CheckCircle2 className="size-4" aria-hidden="true" />
            {t("proofPhoto")}
          </h3>
          <div className="overflow-hidden rounded-lg border border-border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={mission.proofPhotoUrl}
              alt={t("proofPhotoAlt", {
                day: mission.day,
                title: mission.title,
              })}
              className="h-auto w-full object-cover"
            />
          </div>
        </section>
      )}
    </div>
  );
}
