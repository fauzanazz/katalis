import { useEffect, useState } from "react";
import { useNavigate, useParams } from "@tanstack/react-router";
import { Check, ChevronLeft, Image as ImageIcon, PartyPopper, Sparkles } from "lucide-react";
import { getBadgeDef } from "@/lib/badges/definitions";
import { Button } from "@/components/ui/button";
import { m } from "@/paraglide/messages";
import { useApp } from "../app/context";
import { getQuest } from "../data/content";
import { completeMission, getProgress } from "../data/store";
import { evaluateAwards } from "../data/awards";
import { t, type Locale, type Mission } from "../data/types";
import { STR } from "../strings";
import { aiReachable, missionTip, scriptedReply } from "../data/ai";

function dayLabel(day: number, locale: Locale): string {
  return locale === "zh" ? `第 ${day} 天` : `${t(STR.day, locale)} ${day}`;
}

export function Quest() {
  const { questId } = useParams({ from: "/quest/$questId" });
  const { profile, locale } = useApp();
  const navigate = useNavigate();
  const quest = getQuest(questId);

  const [doneIds, setDoneIds] = useState<Set<string>>(new Set());
  const [completedAt, setCompletedAt] = useState<number | undefined>();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [newBadges, setNewBadges] = useState<string[]>([]);
  const [tipByMission, setTipByMission] = useState<Record<string, string>>({});
  const [tipLoading, setTipLoading] = useState<string | null>(null);

  useEffect(() => {
    if (!profile || !quest) return;
    let active = true;
    getProgress(profile.id, quest.id).then((p) => {
      if (!active) return;
      setDoneIds(new Set(p?.completedMissionIds ?? []));
      setCompletedAt(p?.completedAt);
      // Open the first unfinished mission by default.
      const firstOpen = quest.missions.find((mi) => !p?.completedMissionIds.includes(mi.id));
      setExpanded(firstOpen?.id ?? quest.missions[0]?.id ?? null);
    });
    return () => {
      active = false;
    };
  }, [profile, quest]);

  if (!quest) {
    return (
      <div className="p-6">
        <Button variant="ghost" onClick={() => navigate({ to: "/discover" })}>
          <ChevronLeft className="size-5" /> {m.common_back()}
        </Button>
      </div>
    );
  }

  async function markDone(missionId: string) {
    if (!profile || !quest) return;
    const record = await completeMission(profile.id, quest.id, missionId, quest.missions.length);
    setDoneIds(new Set(record.completedMissionIds));
    setCompletedAt(record.completedAt);
    const earned = await evaluateAwards(profile.id);
    if (earned.length) setNewBadges(earned);
    // Advance to the next unfinished mission.
    const next = quest.missions.find((mi) => !record.completedMissionIds.includes(mi.id));
    setExpanded(next?.id ?? null);
  }

  async function fetchTip(mission: Mission) {
    if (!profile || !quest) return;
    if (!aiReachable()) {
      setTipByMission((prev) => ({ ...prev, [mission.id]: scriptedReply(locale) }));
      return;
    }
    setTipLoading(mission.id);
    try {
      const tip = await missionTip({
        locale,
        childName: profile.name,
        questTitle: t(quest.title, locale),
        missionTitle: t(mission.title, locale),
        instructions: mission.instructions.map((step) => t(step, locale)),
      });
      setTipByMission((prev) => ({ ...prev, [mission.id]: tip }));
    } catch {
      setTipByMission((prev) => ({ ...prev, [mission.id]: scriptedReply(locale) }));
    } finally {
      setTipLoading(null);
    }
  }

  const doneCount = doneIds.size;
  const total = quest.missions.length;

  return (
    <div className="flex flex-col gap-5 p-5">
      <button
        type="button"
        onClick={() => navigate({ to: "/discover" })}
        className="flex items-center gap-1 self-start text-sm font-medium text-muted-foreground"
      >
        <ChevronLeft className="size-5" aria-hidden /> {m.common_back()}
      </button>

      <header className="flex flex-col items-center gap-2 text-center">
        <span className="text-5xl" aria-hidden>{quest.emoji}</span>
        <h1 className="type-h2 text-ink">{t(quest.title, locale)}</h1>
        <p className="max-w-xs text-muted-foreground">“{t(quest.dream, locale)}”</p>
        <div className="mt-1 h-2 w-full max-w-xs overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${(doneCount / total) * 100}%` }}
          />
        </div>
        <span className="text-sm font-medium text-primary">
          {doneCount}/{total}
        </span>
      </header>

      {completedAt && (
        <div className="flex flex-col items-center gap-3 rounded-3xl bg-green-leaf-light p-5 text-center">
          <PartyPopper className="size-8 text-green-leaf-deep" aria-hidden />
          <p className="text-lg font-bold text-ink">{t(STR.questDone, locale)}</p>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => navigate({ to: "/gallery" })}>
              <ImageIcon className="size-4" /> {t(STR.addWork, locale)}
            </Button>
          </div>
        </div>
      )}

      {newBadges.length > 0 && (
        <div className="flex items-center gap-3 rounded-2xl bg-yellow-sun-light p-4">
          <span className="text-3xl" aria-hidden>{getBadgeDef(newBadges[0])?.icon ?? "🏅"}</span>
          <div>
            <p className="font-bold text-ink">{t(STR.newBadge, locale)}</p>
            <button
              type="button"
              className="text-sm text-primary underline"
              onClick={() => navigate({ to: "/badges" })}
            >
              {m.badges_title()}
            </button>
          </div>
        </div>
      )}

      <ul className="flex flex-col gap-3">
        {quest.missions.map((mission) => {
          const isDone = doneIds.has(mission.id);
          const isOpen = expanded === mission.id;
          return (
            <li key={mission.id} className="overflow-hidden rounded-2xl bg-plain-surface shadow-sm">
              <button
                type="button"
                onClick={() => setExpanded(isOpen ? null : mission.id)}
                className="flex w-full items-center gap-3 p-4 text-left"
              >
                <span
                  className={`flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                    isDone ? "bg-green-leaf-deep text-white" : "bg-muted text-muted-foreground"
                  }`}
                  aria-hidden
                >
                  {isDone ? <Check className="size-5" /> : mission.day}
                </span>
                <span className="flex flex-1 flex-col">
                  <span className="text-xs font-medium text-muted-foreground">{dayLabel(mission.day, locale)}</span>
                  <span className="font-semibold text-ink">{t(mission.title, locale)}</span>
                </span>
              </button>

              {isOpen && (
                <div className="flex flex-col gap-4 border-t border-border px-4 pb-4 pt-3">
                  <Section label={t(STR.steps, locale)} items={mission.instructions.map((i) => t(i, locale))} ordered />
                  {mission.materials.length > 0 && (
                    <Section label={t(STR.materials, locale)} items={mission.materials.map((i) => t(i, locale))} />
                  )}
                  {mission.tips.length > 0 && (
                    <Section label={t(STR.tips, locale)} items={mission.tips.map((i) => t(i, locale))} />
                  )}
                  {tipByMission[mission.id] ? (
                    <div className="flex items-start gap-2 rounded-2xl bg-pink-bloom-soft p-3">
                      <Sparkles className="mt-0.5 size-4 shrink-0 text-pink-bloom" aria-hidden />
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                          {t(STR.kitTip, locale)}
                        </p>
                        <p className="text-sm text-ink">{tipByMission[mission.id]}</p>
                      </div>
                    </div>
                  ) : (
                    <Button
                      variant="secondary"
                      onClick={() => fetchTip(mission)}
                      disabled={tipLoading === mission.id}
                    >
                      <Sparkles className="size-4" />
                      {tipLoading === mission.id ? m.mentor_thinking() : t(STR.getKitTip, locale)}
                    </Button>
                  )}
                  <Button
                    onClick={() => markDone(mission.id)}
                    disabled={isDone}
                    variant={isDone ? "secondary" : "default"}
                  >
                    {isDone ? (
                      <>
                        <Check className="size-4" /> {t(STR.done, locale)}
                      </>
                    ) : (
                      t(STR.markDone, locale)
                    )}
                  </Button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Section({ label, items, ordered }: { label: string; items: string[]; ordered?: boolean }) {
  const ListTag = ordered ? "ol" : "ul";
  return (
    <div>
      <p className="mb-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
      <ListTag className={`flex flex-col gap-1 ${ordered ? "list-inside list-decimal" : "list-inside list-disc"}`}>
        {items.map((item, i) => (
          <li key={i} className="text-sm text-ink">
            {item}
          </li>
        ))}
      </ListTag>
    </div>
  );
}
