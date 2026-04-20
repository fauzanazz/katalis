"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

interface ChildCardProps {
  child: {
    id: string;
    locale: string;
    claimedAt: string;
    latestTalents?: string[];
    questCount?: number;
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
          <h3 className="font-semibold">{t("childTitle", { id: child.id.slice(-4) })}</h3>
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

      <div className="mt-3 flex gap-2">
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
