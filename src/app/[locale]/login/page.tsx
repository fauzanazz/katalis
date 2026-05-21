"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { ArrowRight, ClipboardCheck, Rocket, ShieldCheck, Sparkles } from "lucide-react";
import { Link } from "@/i18n/navigation";

const PARENT_SIGNALS = ["parentSignal1", "parentSignal2", "parentSignal3"] as const;
const CHILD_SIGNALS = ["childSignal1", "childSignal2", "childSignal3"] as const;
const PROGRESS_BARS = [76, 52, 88] as const;

export default function LoginPage() {
  const t = useTranslations("auth.choose");

  return (
    <div className="bg-general-surface px-4 py-6 sm:px-6 lg:px-8">
      <h1 className="sr-only">{t("title")}</h1>
      <div className="mx-auto grid min-h-[calc(100vh-18rem)] w-full max-w-7xl items-stretch gap-5 lg:grid-cols-2">
        <Link
          href="/login/parent"
          className="group relative flex min-h-[520px] overflow-hidden rounded-lg border border-green-leaf-deep bg-auth-surface px-6 py-7 text-ink shadow-sm transition-transform hover:-translate-y-1 hover:shadow-md focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-green-leaf-deep/35 sm:px-8 lg:px-10"
          aria-label={`${t("parentTitle")}. ${t("parentDesc")}`}
        >
          <div
            className="absolute right-0 top-0 h-28 w-28 border-b border-l border-green-leaf-deep/40 bg-white/55"
            aria-hidden
          />
          <div className="relative z-10 flex w-full flex-col justify-between gap-8">
            <div>
              <div className="mb-9 flex items-center justify-between gap-4">
                <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  <ShieldCheck className="size-4" aria-hidden />
                  {t("parentKicker")}
                </span>
                <ClipboardCheck className="size-7 text-green-leaf-deep" strokeWidth={1.7} aria-hidden />
              </div>

              <p className="mb-3 max-w-md text-sm font-medium text-muted-foreground">{t("subtitle")}</p>
              <h2 className="max-w-lg font-display text-4xl font-semibold leading-[1.03] tracking-normal text-ink sm:text-5xl lg:text-6xl">
                {t("parentTitle")}
              </h2>
              <p className="mt-5 max-w-md text-base leading-7 text-foreground sm:text-lg">
                {t("parentDesc")}
              </p>
            </div>

            <div>
              <div className="mb-7 border border-green-leaf-deep/55 bg-white/70 p-5">
                <div className="mb-5 flex items-center justify-between gap-4 border-b border-border pb-4">
                  <span className="text-sm font-semibold text-ink">{t("parentBoardTitle")}</span>
                  <span className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                    76%
                  </span>
                </div>
                <div className="grid gap-3">
                  {PROGRESS_BARS.map((widthPercent, index) => (
                    <div key={widthPercent} className="grid grid-cols-[4rem_1fr] items-center gap-3">
                      <div className="h-2 bg-green-leaf-light" />
                      <div className="h-2 bg-green-leaf-light">
                        <div
                          className="h-full bg-green-leaf-deep transition-colors group-hover:bg-mint-cloud"
                          style={{ width: `${widthPercent}%` }}
                        />
                      </div>
                      <span className="sr-only">
                        {index + 1}: {widthPercent}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mb-7 grid gap-3 text-sm font-medium text-foreground sm:grid-cols-3">
                {PARENT_SIGNALS.map((key) => (
                  <span key={key} className="border border-border bg-white/80 px-4 py-3">
                    {t(key)}
                  </span>
                ))}
              </div>

              <span className="inline-flex min-h-12 items-center gap-3 rounded-md bg-ink px-5 text-sm font-semibold text-white transition-transform group-hover:translate-x-1">
                {t("parentCta")}
                <ArrowRight className="size-4" aria-hidden />
              </span>
            </div>
          </div>
        </Link>

        <Link
          href="/login/child"
          className="group relative flex min-h-[520px] overflow-hidden rounded-lg border border-yellow-sun-deep bg-yellow-sun-light px-6 py-7 text-ink shadow-sm transition-transform hover:-translate-y-1 hover:shadow-md focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-yellow-sun-deep/35 sm:px-8 lg:px-10"
          aria-label={`${t("childTitle")}. ${t("childDesc")}`}
        >
          <div className="absolute -right-10 top-8 h-32 w-32 rotate-12 bg-pink-bloom" aria-hidden />
          <div className="absolute -bottom-8 left-10 h-24 w-24 -rotate-12 bg-blue-ocean-light" aria-hidden />

          <div className="relative z-10 grid w-full gap-8 md:grid-cols-[minmax(0,1fr)_minmax(220px,300px)] md:items-center">
            <div className="flex min-w-0 flex-col justify-between gap-8">
              <div>
                <div className="mb-8 flex items-center justify-between gap-4">
                  <span className="inline-flex rotate-[-2deg] items-center gap-2 rounded-md bg-ink px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-white shadow-[5px_5px_0_var(--pink-bloom)]">
                    <Sparkles className="size-4" aria-hidden />
                    {t("childKicker")}
                  </span>
                  <Rocket className="size-9 rotate-12 text-ink" strokeWidth={2.4} aria-hidden />
                </div>

                <h2 className="max-w-md font-display text-4xl font-black leading-[0.98] tracking-normal text-ink sm:text-5xl lg:text-6xl">
                  {t("childTitle")}
                </h2>
                <p className="mt-5 max-w-sm text-lg font-semibold leading-7 text-foreground">
                  {t("childDesc")}
                </p>
              </div>

              <div>
                <div className="mb-7 flex flex-wrap gap-3 text-sm font-black text-ink">
                  {CHILD_SIGNALS.map((key, index) => (
                    <span
                      key={key}
                      className="border-2 border-ink bg-white px-4 py-2 shadow-[5px_5px_0_var(--ink)]"
                      style={{ transform: `rotate(${index % 2 === 0 ? -2 : 2}deg)` }}
                    >
                      {t(key)}
                    </span>
                  ))}
                </div>

                <span className="inline-flex min-h-12 items-center gap-3 rounded-md bg-pink-bloom px-5 text-sm font-black text-white shadow-[6px_6px_0_var(--ink)] transition-transform group-hover:-translate-y-1 group-hover:translate-x-1">
                  {t("childCta")}
                  <ArrowRight className="size-5" aria-hidden />
                </span>
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-[300px] md:mx-0">
              <div className="aspect-square rotate-2 border-2 border-ink bg-white p-4 shadow-[10px_10px_0_var(--pink-bloom)] transition-transform duration-300 group-hover:rotate-3">
                <Image
                  src="/images/kit-mascot.png"
                  alt=""
                  width={320}
                  height={320}
                  priority
                  className="h-full w-full object-contain mix-blend-multiply transition-transform duration-300 group-hover:scale-105"
                  aria-hidden
                />
              </div>
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}
