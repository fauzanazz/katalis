"use client";

import { useTranslations } from "next-intl";
import {
  BookOpen,
  ListOrdered,
  Package,
  Lightbulb,
  CheckCircle2,
} from "lucide-react";

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
}

export function MissionDetail({ mission }: MissionDetailProps) {
  const t = useTranslations("quest.overview");

  const isCompleted = mission.status === "completed";

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <div className="mb-1 flex items-center gap-2">
          <span className="text-sm font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-400">
            {t("dayLabel", { day: mission.day })}
          </span>
          {isCompleted && (
            <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
              <CheckCircle2 className="size-3" aria-hidden="true" />
              {t("statusCompleted")}
            </span>
          )}
        </div>
        <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
          {mission.title}
        </h2>
      </div>

      {/* Description */}
      <section aria-labelledby="mission-description">
        <h3
          id="mission-description"
          className="mb-2 flex items-center gap-2 text-sm font-semibold text-zinc-700 dark:text-zinc-300"
        >
          <BookOpen className="size-4" aria-hidden="true" />
          {t("description")}
        </h3>
        <p className="leading-relaxed text-zinc-600 dark:text-zinc-400">
          {mission.description}
        </p>
      </section>

      {/* Instructions */}
      {mission.instructions.length > 0 && (
        <section aria-labelledby="mission-instructions">
          <h3
            id="mission-instructions"
            className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-700 dark:text-zinc-300"
          >
            <ListOrdered className="size-4" aria-hidden="true" />
            {t("instructions")}
          </h3>
          <ol className="flex flex-col gap-2" role="list">
            {mission.instructions.map((step, index) => (
              <li
                key={index}
                className="flex gap-3 rounded-lg border border-zinc-100 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900/50"
              >
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                  {index + 1}
                </span>
                <span className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
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
          className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-700 dark:text-zinc-300"
        >
          <Package className="size-4" aria-hidden="true" />
          {t("materials")}
        </h3>
        {mission.materials.length > 0 ? (
          <ul className="flex flex-wrap gap-2" role="list">
            {mission.materials.map((material, index) => (
              <li
                key={index}
                className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300"
              >
                {material}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm italic text-zinc-400 dark:text-zinc-500">
            {t("noMaterials")}
          </p>
        )}
      </section>

      {/* Tips */}
      <section aria-labelledby="mission-tips">
        <h3
          id="mission-tips"
          className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-700 dark:text-zinc-300"
        >
          <Lightbulb className="size-4" aria-hidden="true" />
          {t("tips")}
        </h3>
        {mission.tips.length > 0 ? (
          <ul className="flex flex-col gap-2" role="list">
            {mission.tips.map((tip, index) => (
              <li
                key={index}
                className="flex gap-2 rounded-lg border border-purple-100 bg-purple-50 p-3 text-sm text-purple-800 dark:border-purple-800 dark:bg-purple-900/20 dark:text-purple-300"
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
          <p className="text-sm italic text-zinc-400 dark:text-zinc-500">
            {t("noTips")}
          </p>
        )}
      </section>

      {/* Proof photo (if completed) */}
      {isCompleted && mission.proofPhotoUrl && (
        <section aria-labelledby="mission-proof">
          <h3
            id="mission-proof"
            className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-700 dark:text-zinc-300"
          >
            <CheckCircle2 className="size-4" aria-hidden="true" />
            Proof Photo
          </h3>
          <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-700">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={mission.proofPhotoUrl}
              alt={`Proof photo for Day ${mission.day}: ${mission.title}`}
              className="h-auto w-full object-cover"
            />
          </div>
        </section>
      )}
    </div>
  );
}
