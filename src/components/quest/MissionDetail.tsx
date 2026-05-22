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

const STEP_COLORS = [
  { bg: "var(--blue-ocean-light)", text: "white" },
  { bg: "var(--pink-bloom)", text: "white" },
  { bg: "var(--green-leaf-deep)", text: "white" },
  { bg: "var(--yellow-sun)", text: "var(--ink)" },
  { bg: "var(--lavender-mist)", text: "white" },
  { bg: "var(--mint-cloud)", text: "white" },
];

const PILL_COLORS = [
  "var(--yellow-sun-light)",
  "var(--green-leaf-light)",
  "var(--pink-bloom-soft)",
  "var(--blue-ocean-light)",
  "var(--mint-cloud)",
];

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
    <div className="flex flex-col gap-7">
      {/* Header */}
      <header className="relative pt-5">
        <span
          className="absolute -top-1 left-0 inline-flex rotate-[-6deg] items-center gap-1 rounded-2xl border-2 border-[color:var(--ink)] bg-[color:var(--yellow-sun)] px-3 py-1 text-sm shadow-[2px_3px_0_0_var(--ink)]"
          style={{ fontFamily: "var(--font-luckiest-guy)" }}
        >
          {t("dayLabel", { day: mission.day })}
        </span>
        <div className="ml-24 flex flex-wrap items-center gap-2">
          {isCompleted && (
            <span
              className="inline-flex items-center gap-1 rounded-full border-2 border-[color:var(--ink)] bg-[color:var(--green-leaf-deep)] px-2.5 py-0.5 text-xs font-black uppercase text-white shadow-[2px_2px_0_0_var(--ink)]"
              style={{ fontFamily: "var(--font-montserrat)" }}
            >
              <CheckCircle2 className="size-3" aria-hidden="true" />
              {t("statusCompleted")}
            </span>
          )}
          {isInProgress && (
            <span
              className="inline-flex items-center gap-1 rounded-full border-2 border-[color:var(--ink)] bg-[color:var(--yellow-sun-light)] px-2.5 py-0.5 text-xs font-black uppercase text-[color:var(--ink)] shadow-[2px_2px_0_0_var(--ink)]"
              style={{ fontFamily: "var(--font-montserrat)" }}
            >
              <Loader2
                className="size-3 animate-spin"
                aria-hidden="true"
              />
              {t("statusInProgress")}
            </span>
          )}
        </div>
        <h2
          className="mt-3 text-3xl leading-tight text-[color:var(--ink)] sm:text-4xl"
          style={{ fontFamily: "var(--font-luckiest-guy)" }}
        >
          {mission.title}
        </h2>
      </header>

      {/* Description — torn-paper card with handwritten body */}
      <section aria-labelledby="mission-description">
        <h3
          id="mission-description"
          className="mb-3 flex items-center gap-2 text-sm font-black uppercase tracking-wider text-[color:var(--ink)]"
          style={{ fontFamily: "var(--font-montserrat)" }}
        >
          <BookOpen className="size-4" aria-hidden="true" />
          {t("description")}
        </h3>
        <div className="sticker-card relative px-5 py-5">
          <span
            aria-hidden="true"
            className="tape-strip left-4 top-[-9px] rotate-[-6deg] rounded-[2px]"
          />
          <span
            aria-hidden="true"
            className="tape-strip right-4 top-[-9px] rotate-[5deg] rounded-[2px]"
            style={{
              background:
                "color-mix(in srgb, var(--pink-bloom-soft) 90%, white)",
            }}
          />
          <p
            className="text-lg leading-relaxed text-[color:var(--ink)]"
            style={{ fontFamily: "var(--font-schoolbell)" }}
          >
            {mission.description}
          </p>
        </div>
      </section>

      {/* Instructions — comic-panel sticker steps */}
      {mission.instructions.length > 0 && (
        <section aria-labelledby="mission-instructions">
          <h3
            id="mission-instructions"
            className="mb-3 flex items-center gap-2 text-sm font-black uppercase tracking-wider text-[color:var(--ink)]"
            style={{ fontFamily: "var(--font-montserrat)" }}
          >
            <ListOrdered className="size-4" aria-hidden="true" />
            {t("instructions")}
          </h3>
          <ol className="flex flex-col gap-4" role="list">
            {mission.instructions.map((step, index) => {
              const c = STEP_COLORS[index % STEP_COLORS.length];
              const tilt = index % 2 === 0 ? "rotate-[-1deg]" : "rotate-[1deg]";
              return (
                <li
                  key={index}
                  className={`sticker-card relative pl-14 pr-4 py-4 ${tilt}`}
                >
                  <span
                    className="absolute -left-4 -top-3 flex size-12 rotate-[-8deg] items-center justify-center rounded-full border-[3px] border-[color:var(--ink)] text-xl shadow-[2px_2px_0_0_var(--ink)]"
                    style={{
                      background: c.bg,
                      color: c.text,
                      fontFamily: "var(--font-luckiest-guy)",
                    }}
                  >
                    {index + 1}
                  </span>
                  <span
                    className="block text-base leading-relaxed text-[color:var(--ink)]"
                    style={{ fontFamily: "var(--font-instrument-sans)" }}
                  >
                    {step}
                  </span>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {/* Materials — chunky sticker pills */}
      <section aria-labelledby="mission-materials">
        <h3
          id="mission-materials"
          className="mb-3 flex items-center gap-2 text-sm font-black uppercase tracking-wider text-[color:var(--ink)]"
          style={{ fontFamily: "var(--font-montserrat)" }}
        >
          <Package className="size-4" aria-hidden="true" />
          {t("materials")}
        </h3>
        {mission.materials.length > 0 ? (
          <ul className="flex flex-wrap gap-2.5" role="list">
            {mission.materials.map((material, index) => (
              <li
                key={index}
                className="sticker-chip sticker-press px-3.5 py-1.5 text-sm font-bold text-[color:var(--ink)]"
                style={{
                  background: PILL_COLORS[index % PILL_COLORS.length],
                  fontFamily: "var(--font-instrument-sans)",
                  transform: `rotate(${index % 2 === 0 ? "-1" : "1"}deg)`,
                }}
              >
                {material}
              </li>
            ))}
          </ul>
        ) : (
          <p
            className="text-base text-[color:var(--muted-foreground)]"
            style={{ fontFamily: "var(--font-schoolbell)" }}
          >
            {t("noMaterials")}
          </p>
        )}
      </section>

      {/* Tips — post-it notes */}
      <section aria-labelledby="mission-tips">
        <h3
          id="mission-tips"
          className="mb-3 flex items-center gap-2 text-sm font-black uppercase tracking-wider text-[color:var(--ink)]"
          style={{ fontFamily: "var(--font-montserrat)" }}
        >
          <Lightbulb className="size-4" aria-hidden="true" />
          {t("tips")}
        </h3>
        {mission.tips.length > 0 ? (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2" role="list">
            {mission.tips.map((tip, index) => (
              <li
                key={index}
                className="relative rounded-md border-2 border-[color:var(--ink)] bg-[color:var(--yellow-sun-light)] p-4 shadow-[3px_4px_0_0_var(--ink)]"
                style={{
                  transform: `rotate(${index % 2 === 0 ? "-1.5" : "1.5"}deg)`,
                }}
              >
                <Lightbulb
                  className="absolute -left-2 -top-2 size-7 rounded-full border-2 border-[color:var(--ink)] bg-[color:var(--yellow-sun)] p-1 text-[color:var(--ink)] shadow-[1px_1px_0_0_var(--ink)]"
                  aria-hidden="true"
                />
                <span
                  className="block text-base leading-relaxed text-[color:var(--ink)]"
                  style={{ fontFamily: "var(--font-schoolbell)" }}
                >
                  {tip}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p
            className="text-base text-[color:var(--muted-foreground)]"
            style={{ fontFamily: "var(--font-schoolbell)" }}
          >
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
            className="mb-3 flex items-center gap-2 text-sm font-black uppercase tracking-wider text-[color:var(--ink)]"
            style={{ fontFamily: "var(--font-montserrat)" }}
          >
            <CheckCircle2 className="size-4" aria-hidden="true" />
            {t("proofPhoto")}
          </h3>
          <div className="overflow-hidden rounded-2xl border-2 border-[color:var(--ink)] shadow-[3px_4px_0_0_var(--ink)]">
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
