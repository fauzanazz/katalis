"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { InterestInsightsClient } from "./InterestInsightsClient";

interface ChildCardProps {
  child: {
    id: string;
    name?: string;
    locale: string;
    claimedAt: string;
    latestTalents?: string[];
    questCount?: number;
    quests?: Array<{ id: string; dream: string; status: string }>;
    tips?: Array<{
      title: string;
      description: string;
      materials: string[];
      category: string;
    }>;
  };
}

export function ChildCard({ child }: ChildCardProps) {
  const t = useTranslations("parent.dashboard");
  const router = useRouter();
  const [isSwitching, setIsSwitching] = useState(false);

  const handleOpenAsChild = async () => {
    setIsSwitching(true);
    try {
      const response = await fetch("/api/parent/switch-child", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ childId: child.id }),
      });

      if (response.ok) {
        router.push("/discover");
        router.refresh();
      }
    } catch (err) {
      console.error("Failed to switch to child:", err);
    } finally {
      setIsSwitching(false);
    }
  };

  const talentEmoji: Record<string, string> = {
    Engineering: "🤖",
    Art: "🎨",
    Narrative: "📖",
    Music: "🎵",
    Science: "🔬",
    Creative: "✨",
    Leadership: "🏆",
    Empathy: "💚",
  };

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold">
            {child.name || t("childTitle", { id: child.id.slice(-4) })}
          </h3>
          <p className="text-xs text-muted-foreground">
            {t("claimedAt", { date: new Date(child.claimedAt).toLocaleDateString() })}
          </p>
        </div>
        {child.questCount !== undefined && (
          <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
            {t("questCount", { count: child.questCount })}
          </span>
        )}
      </div>

      {child.latestTalents && child.latestTalents.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {child.latestTalents.map((talent) => (
            <span
              key={talent}
              className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
            >
              <span aria-hidden="true">{talentEmoji[talent] ?? "🌟"}</span>
              {talent}
            </span>
          ))}
        </div>
      )}

      {child.tips && child.tips.length > 0 && (
        <div className="mt-3">
          <p className="mb-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {t("tipPreview")}
          </p>
          <div className="space-y-1.5">
            {child.tips.slice(0, 2).map((tip) => (
              <div key={tip.title} className="rounded bg-muted/50 px-2.5 py-1.5">
                <p className="text-xs font-medium">{tip.title}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 border-t pt-3">
        <InterestInsightsClient childId={child.id} />
      </div>

      {child.quests && child.quests.length > 0 && (
        <div className="mt-3">
          <p className="mb-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {t("quests")}
          </p>
          <div className="space-y-1">
            {child.quests.slice(0, 3).map((q) => (
              <Link
                key={q.id}
                href={`/parent/quest/${q.id}`}
                className="flex items-center justify-between rounded bg-muted/50 px-2.5 py-1.5 text-xs hover:bg-muted"
              >
                <span className="truncate font-medium">{q.dream}</span>
                <span
                  className={`ml-2 shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                    q.status === "completed"
                      ? "bg-green-100 text-green-700"
                      : q.status === "abandoned"
                        ? "bg-zinc-100 text-zinc-500"
                        : "bg-amber-100 text-amber-700"
                  }`}
                >
                  {q.status}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleOpenAsChild}
          disabled={isSwitching}
          className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {isSwitching ? t("switching") : t("openAsChild")}
        </button>
        <Link
          href={`/parent/reports?childId=${child.id}`}
          className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20"
        >
          {t("viewReports")}
        </Link>
      </div>
    </div>
  );
}
