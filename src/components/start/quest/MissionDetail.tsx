import { useState } from "react";
import {
  BookOpen,
  ListOrdered,
  Package,
  Lightbulb,
  CheckCircle2,
  Loader2,
  ChevronDown,
  ChevronUp,
  Sparkles,
} from "lucide-react";
import { m } from "@/paraglide/messages";
import { MissionActions } from "@/components/start/quest/MissionActions";
import { MissionChat } from "@/components/start/quest/MissionChat";
import { ReflectionCard } from "@/components/start/quest/ReflectionCard";
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

function MissionHeader({
  mission,
  isCompleted,
  isInProgress,
}: {
  mission: MissionData;
  isCompleted: boolean;
  isInProgress: boolean;
}) {
  return (
    <header className="relative pt-5">
      <span
        className="absolute -top-1 left-0 inline-flex rotate-[-6deg] items-center gap-1 rounded-2xl border-2 border-[color:var(--ink)] bg-[color:var(--yellow-sun)] px-3 py-1 text-sm shadow-[2px_3px_0_0_var(--ink)]"
        style={{ fontFamily: "var(--font-luckiest-guy)" }}
      >
        {m.quest_overview_dayLabel({ day: mission.day })}
      </span>
      <div className="ml-24 flex flex-wrap items-center gap-2">
        {isCompleted && (
          <span
            className="inline-flex items-center gap-1 rounded-full border-2 border-[color:var(--ink)] bg-[color:var(--green-leaf-deep)] px-2.5 py-0.5 text-xs font-black uppercase text-white shadow-[2px_2px_0_0_var(--ink)]"
            style={{ fontFamily: "var(--font-montserrat)" }}
          >
            <CheckCircle2 className="size-3" aria-hidden="true" />
            {m.quest_overview_statusCompleted()}
          </span>
        )}
        {isInProgress && (
          <span
            className="inline-flex items-center gap-1 rounded-full border-2 border-[color:var(--ink)] bg-[color:var(--yellow-sun-light)] px-2.5 py-0.5 text-xs font-black uppercase text-[color:var(--ink)] shadow-[2px_2px_0_0_var(--ink)]"
            style={{ fontFamily: "var(--font-montserrat)" }}
          >
            <Loader2 className="size-3 animate-spin" aria-hidden="true" />
            {m.quest_overview_statusInProgress()}
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
  );
}

export function MissionDetail({
  mission,
  questId,
  onStatusChange,
  readOnly = false,
  onBadgesEarned,
}: MissionDetailProps) {
  const isCompleted = mission.status === "completed";
  const isInProgress = mission.status === "in_progress";
  const isLocked = mission.status === "locked";

  // "Need a hint?" collapsible state
  const [hintOpen, setHintOpen] = useState(false);

  // ─── Quest Buddy layout: all unlocked missions (available / in_progress / completed) ──
  if (!isLocked && questId) {
    return (
      <div className="flex flex-col gap-6">
        <MissionHeader
          mission={mission}
          isCompleted={isCompleted}
          isInProgress={isInProgress}
        />

        {/* Mission description — shown prominently so child knows the goal */}
        <div className="sticker-card relative px-5 py-5">
          <span aria-hidden="true" className="tape-strip left-4 top-[-9px] rotate-[-6deg] rounded-[2px]" />
          <span
            aria-hidden="true"
            className="tape-strip right-4 top-[-9px] rotate-[5deg] rounded-[2px]"
            style={{ background: "color-mix(in srgb, var(--pink-bloom-soft) 90%, white)" }}
          />
          <p
            className="text-lg leading-relaxed text-[color:var(--ink)]"
            style={{ fontFamily: "var(--font-schoolbell)" }}
          >
            {mission.description}
          </p>
        </div>

        {/* Quest Buddy chat — auto-expanded, greets child + checks materials conversationally */}
        <section aria-label={m.mentor_learningCycle_title()}>
          <h3
            className="mb-3 flex items-center gap-2 text-sm font-black uppercase tracking-wider text-[color:var(--ink)]"
            style={{ fontFamily: "var(--font-montserrat)" }}
          >
            <Sparkles className="size-4" aria-hidden="true" />
            {m.mentor_learningCycle_title()}
          </h3>
          <MissionChat
            key={mission.id}
            questId={questId}
            missionId={mission.id}
            missionDay={mission.day}
            missionTitle={mission.title}
            defaultExpanded={true}
          />
        </section>


        {/* "Need a Hint?" — collapsible description + instructions + tips */}
        <section>
          <button
            type="button"
            onClick={() => setHintOpen((prev) => !prev)}
            className="flex w-full items-center justify-between rounded-xl border-2 border-[color:var(--ink)] bg-white px-4 py-3 shadow-[2px_2px_0_0_var(--ink)] transition-all hover:brightness-95"
            aria-expanded={hintOpen}
          >
            <span
              className="flex items-center gap-2 text-sm font-black uppercase tracking-wide text-[color:var(--ink)]"
              style={{ fontFamily: "var(--font-montserrat)" }}
            >
              <Lightbulb className="size-4" aria-hidden="true" />
              {m.mentor_needHint()}
            </span>
            {hintOpen ? (
              <ChevronUp className="size-5 text-[color:var(--ink)]" aria-hidden="true" />
            ) : (
              <ChevronDown className="size-5 text-[color:var(--ink)]" aria-hidden="true" />
            )}
          </button>

          {hintOpen && (
            <div className="mt-3 flex flex-col gap-5 rounded-xl border-2 border-[color:var(--ink)] bg-white p-5 shadow-[2px_2px_0_0_var(--ink)]">
              {/* Instructions */}
              {mission.instructions.length > 0 && (
                <div>
                  <h4
                    className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-wider text-[color:var(--ink)]"
                    style={{ fontFamily: "var(--font-montserrat)" }}
                  >
                    <ListOrdered className="size-3.5" aria-hidden="true" />
                    {m.quest_overview_instructions()}
                  </h4>
                  <ol className="flex flex-col gap-3" role="list">
                    {mission.instructions.map((step, index) => {
                      const c = STEP_COLORS[index % STEP_COLORS.length];
                      const tilt = index % 2 === 0 ? "rotate-[-1deg]" : "rotate-[1deg]";
                      return (
                        <li key={index} className={`sticker-card relative pl-14 pr-4 py-4 ${tilt}`}>
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
                </div>
              )}

              {/* Tips */}
              {mission.tips.length > 0 && (
                <div>
                  <h4
                    className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-wider text-[color:var(--ink)]"
                    style={{ fontFamily: "var(--font-montserrat)" }}
                  >
                    <Lightbulb className="size-3.5" aria-hidden="true" />
                    {m.quest_overview_tips()}
                  </h4>
                  <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2" role="list">
                    {mission.tips.map((tip, index) => (
                      <li
                        key={index}
                        className="relative rounded-md border-2 border-[color:var(--ink)] bg-[color:var(--yellow-sun-light)] p-4 shadow-[3px_4px_0_0_var(--ink)]"
                        style={{ transform: `rotate(${index % 2 === 0 ? "-1.5" : "1.5"}deg)` }}
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
                </div>
              )}
            </div>
          )}
        </section>

        {/* Reflection card + proof photo — completed missions */}
        {isCompleted && (
          <ReflectionCard questId={questId} missionDay={mission.day} />
        )}
        {readOnly && isCompleted && mission.proofPhotoUrl && (
          <section aria-labelledby="mission-proof">
            <h3
              id="mission-proof"
              className="mb-3 flex items-center gap-2 text-sm font-black uppercase tracking-wider text-[color:var(--ink)]"
              style={{ fontFamily: "var(--font-montserrat)" }}
            >
              <CheckCircle2 className="size-4" aria-hidden="true" />
              {m.quest_overview_proofPhoto()}
            </h3>
            <div className="overflow-hidden rounded-2xl border-2 border-[color:var(--ink)] shadow-[3px_4px_0_0_var(--ink)]">
              <img
                src={mission.proofPhotoUrl}
                alt={m.quest_overview_proofPhotoAlt({ day: mission.day, title: mission.title })}
                className="h-auto w-full object-cover"
              />
            </div>
          </section>
        )}

        {/* Mission actions */}
        {!readOnly && onStatusChange && (
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
      </div>
    );
  }

  // ─── Locked layout ────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-7">
      <MissionHeader
        mission={mission}
        isCompleted={isCompleted}
        isInProgress={isInProgress}
      />

      {/* Description */}
      <section aria-labelledby="mission-description">
        <h3
          id="mission-description"
          className="mb-3 flex items-center gap-2 text-sm font-black uppercase tracking-wider text-[color:var(--ink)]"
          style={{ fontFamily: "var(--font-montserrat)" }}
        >
          <BookOpen className="size-4" aria-hidden="true" />
          {m.quest_overview_description()}
        </h3>
        <div className="sticker-card relative px-5 py-5">
          <span aria-hidden="true" className="tape-strip left-4 top-[-9px] rotate-[-6deg] rounded-[2px]" />
          <span
            aria-hidden="true"
            className="tape-strip right-4 top-[-9px] rotate-[5deg] rounded-[2px]"
            style={{ background: "color-mix(in srgb, var(--pink-bloom-soft) 90%, white)" }}
          />
          <p
            className="text-lg leading-relaxed text-[color:var(--ink)]"
            style={{ fontFamily: "var(--font-schoolbell)" }}
          >
            {mission.description}
          </p>
        </div>
      </section>

      {/* Instructions */}
      {mission.instructions.length > 0 && (
        <section aria-labelledby="mission-instructions">
          <h3
            id="mission-instructions"
            className="mb-3 flex items-center gap-2 text-sm font-black uppercase tracking-wider text-[color:var(--ink)]"
            style={{ fontFamily: "var(--font-montserrat)" }}
          >
            <ListOrdered className="size-4" aria-hidden="true" />
            {m.quest_overview_instructions()}
          </h3>
          <ol className="flex flex-col gap-4" role="list">
            {mission.instructions.map((step, index) => {
              const c = STEP_COLORS[index % STEP_COLORS.length];
              const tilt = index % 2 === 0 ? "rotate-[-1deg]" : "rotate-[1deg]";
              return (
                <li key={index} className={`sticker-card relative pl-14 pr-4 py-4 ${tilt}`}>
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

      {/* Materials */}
      <section aria-labelledby="mission-materials">
        <h3
          id="mission-materials"
          className="mb-3 flex items-center gap-2 text-sm font-black uppercase tracking-wider text-[color:var(--ink)]"
          style={{ fontFamily: "var(--font-montserrat)" }}
        >
          <Package className="size-4" aria-hidden="true" />
          {m.quest_overview_materials()}
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
            {m.quest_overview_noMaterials()}
          </p>
        )}
      </section>

      {/* Tips */}
      <section aria-labelledby="mission-tips">
        <h3
          id="mission-tips"
          className="mb-3 flex items-center gap-2 text-sm font-black uppercase tracking-wider text-[color:var(--ink)]"
          style={{ fontFamily: "var(--font-montserrat)" }}
        >
          <Lightbulb className="size-4" aria-hidden="true" />
          {m.quest_overview_tips()}
        </h3>
        {mission.tips.length > 0 ? (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2" role="list">
            {mission.tips.map((tip, index) => (
              <li
                key={index}
                className="relative rounded-md border-2 border-[color:var(--ink)] bg-[color:var(--yellow-sun-light)] p-4 shadow-[3px_4px_0_0_var(--ink)]"
                style={{ transform: `rotate(${index % 2 === 0 ? "-1.5" : "1.5"}deg)` }}
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
            {m.quest_overview_noTips()}
          </p>
        )}
      </section>

      {/* Reflection — completed missions */}
      {isCompleted && questId && (
        <ReflectionCard questId={questId} missionDay={mission.day} />
      )}

      {/* Mission actions */}
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

      {/* Read-only proof photo */}
      {readOnly && isCompleted && mission.proofPhotoUrl && (
        <section aria-labelledby="mission-proof">
          <h3
            id="mission-proof"
            className="mb-3 flex items-center gap-2 text-sm font-black uppercase tracking-wider text-[color:var(--ink)]"
            style={{ fontFamily: "var(--font-montserrat)" }}
          >
            <CheckCircle2 className="size-4" aria-hidden="true" />
            {m.quest_overview_proofPhoto()}
          </h3>
          <div className="overflow-hidden rounded-2xl border-2 border-[color:var(--ink)] shadow-[3px_4px_0_0_var(--ink)]">
            <img
              src={mission.proofPhotoUrl}
              alt={m.quest_overview_proofPhotoAlt({
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
