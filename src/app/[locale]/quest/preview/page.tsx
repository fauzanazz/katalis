"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Sparkles, ArrowLeft, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter, Link } from "@/i18n/navigation";

interface GuestMission {
  day: number;
  title: string;
  description: string;
  instructions: string[];
  materials: string[];
  tips: string[];
  status: string;
}

interface GuestQuest {
  dream: string;
  localContext: string;
  missions: GuestMission[];
}

export default function QuestPreviewPage() {
  const t = useTranslations("quest.preview");
  const router = useRouter();

  const [quest, setQuest] = useState<GuestQuest | null>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem("guest_quest");
    if (!raw) {
      router.replace("/discover");
      return;
    }
    try {
      const parsed = JSON.parse(raw) as GuestQuest;
      setQuest(parsed);
    } catch {
      router.replace("/discover");
    }
  }, [router]);

  if (!quest) {
    return (
      <div className="mx-auto flex min-h-[50vh] w-full max-w-2xl items-center justify-center px-4">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  const loginBanner = (
    <div className="rounded-xl border border-amber-300 bg-amber-50 p-5 text-center">
      <p className="mb-3 font-semibold text-amber-900">{t("loginBanner")}</p>
      <Button asChild size="lg" className="bg-[#f6a926] font-bold text-white hover:bg-[#ee9f17]">
        <Link href="/login">
          <LogIn className="mr-2 size-4" />
          {t("loginCta")}
        </Link>
      </Button>
    </div>
  );

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:py-12">
      {/* Header */}
      <div className="mb-6 text-center">
        <div className="mb-3 flex justify-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-amber-100">
            <Sparkles className="size-7 text-amber-600" />
          </div>
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-ink sm:text-4xl">
          {t("title")}
        </h1>
        <p className="mt-2 text-muted-foreground">{t("subtitle")}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("missionCount", { count: quest.missions.length })}
        </p>
      </div>

      {/* Login CTA — top */}
      <div className="mb-8">{loginBanner}</div>

      {/* Dream */}
      <div className="mb-6 rounded-xl border border-border bg-card p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t("dreamLabel")}
        </p>
        <p className="mt-1 text-lg font-medium text-ink">{quest.dream}</p>
      </div>

      {/* Mission cards */}
      <div className="flex flex-col gap-4">
        {quest.missions.map((mission) => (
          <div
            key={mission.day}
            className="rounded-xl border border-border bg-card p-5"
          >
            <div className="mb-2 flex items-center gap-2">
              <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                {t("dayLabel", { day: mission.day })}
              </span>
              {mission.status === "locked" && (
                <span className="text-xs text-muted-foreground">🔒</span>
              )}
            </div>
            <h2 className="text-base font-bold text-ink">{mission.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {mission.description}
            </p>
          </div>
        ))}
      </div>

      {/* Login CTA — bottom */}
      <div className="mt-8">{loginBanner}</div>

      {/* Discover again link */}
      <div className="mt-6 flex justify-center">
        <Link
          href="/discover"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground underline underline-offset-2"
        >
          <ArrowLeft className="size-3.5" />
          {t("discoverAgain")}
        </Link>
      </div>
    </div>
  );
}
