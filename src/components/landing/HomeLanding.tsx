"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { Drama, Menu } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher";
import { cn } from "@/lib/utils";
import { getNextHeaderHiddenState } from "./stickyHeader";

const STEP_ACCENTS = [
  { circle: "bg-[#619bf7]", label: "1" },
  { circle: "bg-[#f3b835]", label: "2" },
  { circle: "bg-[#c9e094]", label: "3" },
  { circle: "bg-[#e3a8d2]", label: "4" },
  { circle: "bg-[#ff9dc4]", label: "5" },
] as const;

const TAG_STYLES = [
  "bg-[#f6a926]",
  "bg-[#f7ce4f]",
  "bg-[#c9e094]",
  "bg-[#70a5f5]",
  "bg-[#f6a926]",
] as const;

/** Figma Key Features — 2×2 diagonal blue / yellow */
const FEATURE_CARDS = [
  { id: "talentScout" as const, variant: "blue" as const, bodyTone: "soft" as const },
  { id: "questBuddy" as const, variant: "yellow" as const, bodyTone: "white" as const },
  { id: "squadGallery" as const, variant: "yellow" as const, bodyTone: "white" as const },
  { id: "parentBridge" as const, variant: "blue" as const, bodyTone: "soft" as const },
];

function FeatureSpotlightCard({
  variant,
  bodyTone,
  title,
  body,
}: {
  variant: "blue" | "yellow";
  bodyTone: "soft" | "white";
  title: string;
  body: string;
}) {
  const bodyClass =
    bodyTone === "soft" ? "text-white/90" : "text-[#fffaf0]";

  return (
    <li
      className={cn(
        "relative isolate flex min-h-[148px] flex-col overflow-hidden rounded-2xl p-4 sm:min-h-[160px] sm:p-5",
        variant === "blue" &&
          "bg-gradient-to-br from-[#6c9ef0] via-[#6295ea] to-[#5a8ce2] shadow-[inset_0_1px_0_rgb(255_255_255_/_0.12)]",
        variant === "yellow" &&
          "bg-gradient-to-br from-[#ffe99a] via-[#f5c843] to-[#eba414] shadow-[inset_0_1px_0_rgb(255_255_255_/_0.14)]",
      )}
    >
      {variant === "blue" ? (
        <>
          <div
            aria-hidden
            className="pointer-events-none absolute -left-6 -top-8 size-[6rem] rounded-full bg-white/10 blur-xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-10 -right-4 size-[8rem] rounded-[40%] bg-[#4f81d9]/28 blur-2xl"
          />
        </>
      ) : (
        <>
          <div
            aria-hidden
            className="pointer-events-none absolute -left-4 -top-6 size-[6.5rem] rounded-full bg-[#fff6d7]/22 blur-xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-10 -right-3 size-[7.5rem] rounded-[42%] bg-[#f0b61e]/24 blur-2xl"
          />
        </>
      )}
      <div
        aria-hidden
        className={cn(
          "absolute inset-0",
          variant === "blue" ? "bg-[rgba(21,44,86,0.08)]" : "bg-[rgba(120,74,0,0.06)]",
        )}
      />
      <div className="relative z-10 flex min-h-0 flex-1 flex-col gap-3">
        <span
          className={cn(
            "inline-flex w-fit max-w-full rounded-md px-3 py-1.5 text-base font-semibold leading-tight",
            variant === "blue"
              ? "bg-white/24 text-white"
              : "bg-white/26 text-[#fffdf7]",
          )}
        >
          {title}
        </span>
        <p
          className={cn(
            "max-w-[18rem] text-sm leading-snug tracking-tight sm:text-[14px] sm:leading-[1.35]",
            bodyClass,
          )}
        >
          {body}
        </p>
      </div>
    </li>
  );
}

export function HomeLanding() {
  const t = useTranslations("landing");
  const tNav = useTranslations("nav");
  const [isHeaderHidden, setIsHeaderHidden] = useState(false);
  const lastScrollYRef = useRef(0);

  useEffect(() => {
    lastScrollYRef.current = window.scrollY;

    const handleScroll = () => {
      const currentScrollY = window.scrollY;

      setIsHeaderHidden((previousHidden) =>
        getNextHeaderHiddenState({
          previousScrollY: lastScrollYRef.current,
          currentScrollY,
          isHidden: previousHidden,
        }),
      );

      lastScrollYRef.current = currentScrollY;
    };

    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  const journeySteps = [
    t("journey.step1.title"),
    t("journey.step2.title"),
    t("journey.step3.title"),
    t("journey.step4.title"),
    t("journey.step5.title"),
  ];
  const journeyBodies = [
    t("journey.step1.body"),
    t("journey.step2.body"),
    t("journey.step3.body"),
    t("journey.step4.body"),
    t("journey.step5.body"),
  ];

  const tags = [
    t("community.tagEco"),
    t("community.tagTiny"),
    t("community.tagStory"),
    t("community.tagMini"),
    t("community.tagDesign"),
  ];

  const communityBoxes = [
    {
      src: "/images/community/palette.png",
      bg: "bg-yellow-sun-deep",
      alt: t("community.boxArtAlt"),
    },
    {
      src: "/images/community/science.png",
      bg: "bg-yellow-sun-light",
      alt: t("community.boxScienceAlt"),
    },
    {
      src: "/images/community/mobility.png",
      bg: "bg-blue-ocean-light",
      alt: t("community.boxMobilityAlt"),
    },
  ] as const;

  const navLinkClass =
    "inline-flex min-h-[44px] min-w-[44px] max-w-full items-center justify-center rounded-lg px-3 text-xs font-medium text-foreground transition-colors hover:bg-zinc-100 md:px-3 md:text-sm";

  /** Centered reading column — matches page gutters */
  const shell =
    "mx-auto w-full max-w-6xl px-4 sm:px-6 md:px-8 lg:px-10 xl:max-w-6xl";
  const shellNarrow =
    "mx-auto w-full max-w-2xl px-4 sm:px-6 md:px-8 lg:px-10";

  return (
    <div className="landing-light min-h-screen bg-background text-foreground">
      {/* Top bar — sheet on small screens; inline nav md+ */}
      <header
        className={cn(
          shell,
          "sticky top-0 z-40 flex items-center justify-between gap-4 border-b border-border/60 bg-background/95 pt-4 pb-2 backdrop-blur-sm transition-transform duration-300 sm:pt-5",
          isHeaderHidden && "-translate-y-full",
        )}
      >
          <Link href="/" className="flex min-w-0 items-center gap-2.5">
            <Image
              src="/images/katalis-logo.png"
              alt=""
              width={44}
              height={44}
              className="size-10 shrink-0 object-contain sm:size-11"
              priority
              aria-hidden
            />
            <span className="font-rubik truncate text-base font-medium text-foreground sm:text-lg">
              {t("brandName")}
            </span>
          </Link>
          <nav
            aria-label="Main"
            className="hidden min-w-0 flex-1 items-center justify-end gap-1 md:flex lg:gap-2"
          >
            <Link href="/discover" className={navLinkClass}>
              {tNav("discover")}
            </Link>
            <Link href="/quest" className={navLinkClass}>
              {tNav("quest")}
            </Link>
            <Link href="/gallery" className={navLinkClass}>
              {tNav("gallery")}
            </Link>
            <Link href="/login" className={navLinkClass}>
              {tNav("login")}
            </Link>
            <div className="ml-2 pl-2 lg:ml-4 lg:border-l lg:border-border lg:pl-4">
              <LanguageSwitcher />
            </div>
          </nav>
          <div className="shrink-0 md:hidden">
            <Sheet>
              <SheetTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="text-foreground"
                  aria-label={t("openMenu")}
                >
                  <Menu className="size-6" strokeWidth={1.5} />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[min(100%,320px)]">
                <SheetHeader>
                  <SheetTitle>{t("navSheetTitle")}</SheetTitle>
                </SheetHeader>
                <nav className="mt-6 flex flex-col gap-1 px-1" aria-label="Mobile">
                  <Link href="/discover" className={navLinkClass}>
                    {tNav("discover")}
                  </Link>
                  <Link href="/quest" className={navLinkClass}>
                    {tNav("quest")}
                  </Link>
                  <Link href="/gallery" className={navLinkClass}>
                    {tNav("gallery")}
                  </Link>
                  <Link href="/login" className={navLinkClass}>
                    {tNav("login")}
                  </Link>
                  <div className="mt-4 border-t border-zinc-200 pt-4">
                    <LanguageSwitcher />
                  </div>
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </header>

        {/* Hero background — Figma hero stack (Rectangle 411, Vector 5, Groups 307–309) */}
        <section
          className="relative w-full overflow-hidden pb-10 pt-2 sm:pb-12 sm:pt-4 lg:pb-14 lg:pt-8"
          aria-labelledby="hero-heading"
        >
          <HeroFigmaDecor />
          <div
            className={`${shell} relative z-10 lg:grid lg:min-h-[420px] lg:grid-cols-2 lg:items-center lg:gap-10 lg:pb-4 lg:pt-4 xl:gap-14`}
          >
            <div className="px-4 pb-6 pt-6 text-center sm:px-6 lg:px-0 lg:pb-6 lg:pt-4 lg:text-left">
              <div className="mx-auto w-fit rounded-full bg-yellow-sun-deep px-4 py-1.5 lg:mx-0">
                <p className="text-[12.5px] font-bold leading-none tracking-wide text-white sm:text-sm">
                  {t("hero.safePill")}
                </p>
              </div>
              <h1
                id="hero-heading"
                className="mt-5 text-[clamp(1.5rem,4.5vw,2.5rem)] font-medium leading-[1.25] text-ink sm:mt-6 sm:leading-[1.3]"
              >
                {t("hero.title")}
              </h1>
              <p className="mx-auto mt-3 max-w-[280px] text-sm leading-[1.35] text-muted-foreground sm:mt-4 sm:max-w-md sm:text-base lg:mx-0 lg:max-w-xl">
                {t("hero.subtitle")}
              </p>
            </div>

            {/* Hero image + CTA */}
            <div className="relative pb-8 lg:pb-0">
              <div className="relative mx-auto max-w-[430px] overflow-hidden rounded-2xl lg:mx-0 lg:max-w-none">
                <div className="relative aspect-[3/4] w-full sm:aspect-[4/5] lg:aspect-[3/4]">
                  <Image
                    src="/images/landing-hero.png"
                    alt={t("hero.imageAlt")}
                    fill
                    className="object-cover object-[center_32%]"
                    sizes="(max-width: 1024px) min(100vw, 430px), (max-width: 1280px) 45vw, 600px"
                    priority
                  />
                </div>
              </div>
              <Button
                asChild
                className="mx-auto mt-4 flex h-[52px] w-full max-w-[430px] rounded-full border-0 bg-gradient-to-r from-[#f6a926] via-[#f3b835] to-[#f7ce4f] text-lg font-bold !text-white shadow-none hover:opacity-95 lg:mx-0 lg:mt-5"
              >
                <Link href="/login">{t("hero.cta")}</Link>
              </Button>
              <p className="mt-4 text-center text-[14px] leading-[1.3] text-[#444444] lg:text-left">
                {t("hero.meta")}
              </p>
            </div>
          </div>
        </section>

        {/* Problem + supporting stats (layout seperti mockup) */}
        <section
          className="w-full border-t border-border/60 pb-12 pt-10 sm:pb-16 sm:pt-12"
          aria-labelledby="problem-heading"
        >
          <div className={`${shell} max-w-3xl lg:max-w-4xl`}>
            <h2
              id="problem-heading"
              className="text-left text-2xl font-medium leading-snug text-ink sm:text-3xl"
            >
              <span className="block text-left text-xl font-bold text-yellow-sun-deep sm:text-2xl">
                {t("problem.eyebrow")}
              </span>
              <span className="mt-3 block">
                {t("problem.titleBefore")}
                <strong className="font-semibold">{t("problem.titleEmphasis")}</strong>
                {t("problem.titleAfter")}
              </span>
            </h2>
            <p className="mt-4 text-left text-base leading-relaxed text-muted-foreground sm:text-lg">
              {t("problem.body")}
            </p>
          </div>

          <h3 id="stats-heading" className="sr-only">
            {t("stats.sectionTitle")}
          </h3>
          <div
            className={`${shell} mt-10 sm:mt-12`}
            aria-labelledby="stats-heading"
          >
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 md:gap-6 lg:gap-8">
              {/* Kartu biru: chart → angka besar → caption */}
              <div className="flex flex-col items-center rounded-2xl bg-[#d4e5ff]/55 px-6 py-10 sm:py-12">
                <StatDonut
                  valueLabel={t("stats.centerValue")}
                  ariaLabel={`${t("stats.centerValue")}. ${t("stats.donutAria")}`}
                  showValueInCenter={false}
                />
                <p className="mt-8 text-4xl font-bold tracking-tight text-[#5794f6] sm:text-5xl">
                  {t("stats.centerValue")}
                </p>
                <p className="mt-4 max-w-sm text-center text-base font-medium leading-snug text-[#5794f6]/95 sm:text-lg">
                  {t("stats.leftCaption")}
                </p>
              </div>

              {/* Kartu hijau: ikon → judul → caption */}
              <div className="flex flex-col items-center justify-center rounded-2xl bg-[#cfeadb]/55 px-6 py-10 sm:py-12">
                <Drama
                  className="size-[4.5rem] shrink-0 text-[#6d9260] sm:size-24"
                  strokeWidth={1.15}
                  aria-hidden
                />
                <p className="mt-8 text-4xl font-semibold tracking-tight text-[#5c7d52] sm:text-5xl">
                  {t("stats.rightTitle")}
                </p>
                <p className="mt-4 max-w-sm text-center text-base leading-snug text-[#6d9260] sm:text-lg">
                  {t("stats.rightCaption")}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Journey — Figma 3084:12817 (ungu gede): #FCF9EF, Vector 5 + Groups 307–309, step frames 355–359 */}
        <section
          className="relative w-full overflow-hidden bg-[#fcf9ef] py-12 sm:py-14"
          aria-labelledby="journey-heading"
        >
          <JourneyFigmaDecor />
          <div className={`${shell} relative z-10`}>
            <div className="mx-auto max-w-[430px] text-center font-sans">
              <p
                id="journey-eyebrow"
                className="text-[20px] font-bold leading-[1.3] text-[#f6a926]"
              >
                {t("journey.eyebrow")}
              </p>
              <h2
                id="journey-heading"
                className="mt-2 text-[24px] font-normal leading-[1.3] tracking-normal text-[#030914]"
              >
                {t("journey.titleBefore")}
                <strong className="font-semibold">{t("journey.titleEmphasis")}</strong>
                {t("journey.titleAfter")}
              </h2>
            </div>
            <ul className="relative z-10 mx-auto mt-8 flex max-w-[430px] flex-col gap-4 sm:mt-9">
              {journeySteps.map((title, i) => (
                <li
                  key={title}
                  className="flex min-h-[68px] w-full max-w-[347px] shrink-0 items-center gap-4 self-center rounded-2xl bg-white py-2 pl-5 pr-4 shadow-sm shadow-black/[0.03]"
                >
                  <div
                    className={cn(
                      "flex size-[30px] shrink-0 items-center justify-center rounded-full text-base font-medium leading-none text-white",
                      STEP_ACCENTS[i]?.circle,
                    )}
                    aria-hidden
                  >
                    {STEP_ACCENTS[i]?.label}
                  </div>
                  <div className="min-w-0 flex-1 text-left">
                    <p className="text-base font-medium leading-[1.3] text-[#030914]">
                      {title}
                    </p>
                    <p className="mt-0.5 text-sm font-normal leading-[1.3] text-[#444444]">
                      {journeyBodies[i]}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Key features — Figma: 2×2 gradient cards, Instrument Sans */}
        <section className="w-full border-t border-border py-12 sm:py-14">
          <div className={shell}>
          <div className="mx-auto max-w-xl text-center">
            <p className="text-xl font-bold leading-tight text-[#f6a926] sm:text-[20px]">
              {t("features.eyebrow")}
            </p>
            <h2 className="mt-2 text-2xl font-normal leading-snug tracking-tight text-ink sm:text-2xl">
              {t.rich("features.title", {
                accent: (chunks) => (
                  <strong className="font-bold text-ink">{chunks}</strong>
                ),
              })}
            </h2>
          </div>

          <ul className="mx-auto mt-8 grid max-w-xl grid-cols-1 gap-3 sm:max-w-none sm:grid-cols-2 sm:gap-4 lg:max-w-3xl lg:gap-5">
            {FEATURE_CARDS.map(({ id, variant, bodyTone }) => (
              <FeatureSpotlightCard
                key={id}
                variant={variant}
                bodyTone={bodyTone}
                title={t(`features.${id}.title`)}
                body={t(`features.${id}.body`)}
              />
            ))}
          </ul>
          </div>
        </section>

        {/* Community */}
        <section className="w-full border-t border-border py-12 sm:py-14">
          <div className={shell}>
          <p className="text-center text-xl font-bold text-yellow-sun-deep sm:text-2xl">
            {t("community.eyebrow")}
          </p>
          <h2 className="mt-2 text-center text-2xl text-ink sm:text-3xl md:mx-auto md:max-w-2xl">
            {t("community.title")}
          </h2>
          <div className="mt-8 flex flex-wrap justify-center gap-2 sm:gap-3">
            {tags.map((tag, i) => (
              <span
                key={tag}
                className={cn(
                  "rounded-md px-3 py-1.5 text-[11.5px] font-bold text-white sm:text-xs md:text-sm",
                  TAG_STYLES[i % TAG_STYLES.length],
                )}
              >
                {tag}
              </span>
            ))}
          </div>
          <div className="mx-auto mt-8 flex max-w-[360px] flex-wrap justify-center gap-3 sm:max-w-none sm:gap-4 md:gap-6 lg:mt-10">
            {communityBoxes.map((box) => (
              <div
                key={box.src}
                className={cn(
                  "flex size-[100px] items-center justify-center rounded-2xl sm:size-[110px] md:size-32 lg:size-36",
                  box.bg,
                )}
              >
                <Image
                  src={box.src}
                  alt={box.alt}
                  width={112}
                  height={112}
                  className="size-[72px] object-contain sm:size-20 md:size-24 lg:size-[104px]"
                />
              </div>
            ))}
          </div>
          </div>
        </section>

        {/* Closing CTA */}
        <section className="w-full bg-[#fff2c7] py-14 sm:py-16">
          <div className={`${shellNarrow} flex flex-col items-center text-center`}>
            <p className="inline-flex items-center justify-center rounded-full bg-white px-3 py-2 text-[13px] font-bold text-yellow-sun-deep shadow-[0_8px_24px_rgb(246_169_38_/_0.08)] sm:text-sm">
              <span className="flex size-8 items-center justify-center rounded-full bg-yellow-sun-deep px-1 text-[10px] font-bold leading-none text-white">
                <span aria-hidden>✨</span>
              </span>
              <span className="ml-3">{t("closing.freeBadge")}</span>
            </p>
            <h2 className="mt-6 max-w-[min(100%,320px)] text-2xl font-normal leading-snug text-ink sm:max-w-none sm:text-3xl">
              {t("closing.title")}
            </h2>
            <p className="mt-3 text-sm text-muted-foreground sm:text-base">{t("closing.sub")}</p>
            <div className="mt-8 flex w-full max-w-[420px] flex-col gap-3 sm:max-w-lg sm:flex-row sm:justify-center md:max-w-2xl">
              <Button
                asChild
                className="h-[52px] w-full shrink-0 rounded-2xl border-0 bg-gradient-to-r from-[#f6a926] to-[#f7ce4f] text-lg font-bold !text-white hover:opacity-95 sm:flex-1 sm:text-xl md:max-w-[280px]"
              >
                <Link href="/login">{t("closing.primaryCta")}</Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="h-[52px] w-full shrink-0 rounded-2xl border border-zinc-200/80 bg-white text-lg font-medium text-[#030914] hover:bg-zinc-50 sm:flex-1 sm:text-xl md:max-w-[280px]"
              >
                <Link href="/login">{t("closing.secondaryCta")}</Link>
              </Button>
            </div>
          </div>
        </section>

        {/* Footer strip */}
        <footer className="w-full bg-[#13203c] py-10 text-center sm:py-12">
          <div className={shell}>
          <p className="mx-auto max-w-md text-sm leading-relaxed text-zinc-400 sm:text-base">
            {t("closing.footerLine1")}
          </p>
          <nav
            aria-label={t("closing.footerNavLabel")}
            className="mx-auto mt-4 flex max-w-md flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm"
          >
            <Link
              href="/privacy"
              className="text-zinc-400 underline-offset-4 transition-colors hover:text-zinc-300 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              {t("closing.footerPrivacy")}
            </Link>
            <span className="text-zinc-600" aria-hidden>
              ·
            </span>
            <Link
              href="/terms"
              className="text-zinc-400 underline-offset-4 transition-colors hover:text-zinc-300 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              {t("closing.footerTerms")}
            </Link>
            <span className="text-zinc-600" aria-hidden>
              ·
            </span>
            <Link
              href="/contact"
              className="text-zinc-400 underline-offset-4 transition-colors hover:text-zinc-300 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              {t("closing.footerContact")}
            </Link>
          </nav>
          </div>
        </footer>

    </div>
  );
}

/** Journey band — full-bleed atmosphere + scaled blurs (not clip 430px; desktop fills width). */
function JourneyFigmaDecor() {
  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden motion-reduce:hidden"
      aria-hidden
    >
      {/* Atmosfer full-bleed (section sudah bg #fcf9ef) */}
      <div className="absolute inset-y-0 left-0 w-[min(70%,520px)] bg-gradient-to-r from-[rgba(165,160,202,0.14)] via-[rgba(165,160,202,0.06)] to-transparent lg:w-[42%] lg:from-[rgba(165,160,202,0.12)]" />
      <div className="absolute inset-y-0 right-0 w-[min(75%,560px)] bg-gradient-to-l from-[rgba(255,188,140,0.35)] via-[rgba(255,214,190,0.14)] to-transparent lg:w-[48%]" />

      {/* Vector atas — melebar di lg/xl */}
      <div className="absolute inset-x-4 top-[-10%] flex justify-center sm:inset-x-8 lg:inset-x-16 lg:top-[-14%]">
        <div className="h-[min(380px,62vh)] w-full max-w-[430px] rounded-[42%] bg-[rgb(165,160,202)] blur-[88px] sm:h-[min(420px,58vh)] sm:max-w-[min(560px,90vw)] sm:blur-[140px] md:blur-[180px] lg:h-[min(460px,48vh)] lg:max-w-[min(960px,82vw)] lg:blur-[220px] xl:max-w-[min(1100px,78vw)]" />
      </div>

      {/* Group 309 — kiri bawah */}
      <div className="absolute bottom-[-10%] left-[-6%] sm:bottom-[-8%] sm:left-[2%] md:left-[6%] lg:bottom-[-6%] lg:left-[max(1.5rem,calc((100%-72rem)/2-1rem))]">
        <div className="h-[240px] w-[140px] rounded-full bg-[rgba(136,183,168,0.5)] blur-3xl sm:h-[282px] sm:w-[171px] lg:h-[320px] lg:w-[200px]" />
        <div className="absolute left-[10px] top-[48px] h-[200px] w-[110px] rounded-full bg-[rgba(255,188,40,0.45)] blur-2xl sm:left-0 sm:top-[51px] sm:h-[231px] sm:w-[120px] lg:h-[260px] lg:w-[140px]" />
        <div className="absolute left-[24px] top-[96px] h-[170px] w-[68px] rounded-full bg-[rgba(255,188,40,0.42)] blur-xl sm:left-0 sm:top-[99px] sm:h-[183px] sm:w-[73px]" />
      </div>

      {/* Group 307 — kanan */}
      <div className="absolute right-[-4%] top-[3%] sm:right-[4%] md:right-[8%] lg:right-[max(1.5rem,calc((100%-72rem)/2+1rem))] xl:right-[max(3rem,calc((100%-80rem)/2))]">
        <div className="h-[300px] w-[100px] rounded-full bg-[rgba(165,160,202,0.2)] blur-3xl sm:h-[336px] sm:w-[118px] lg:h-[380px] lg:w-[140px]" />
        <div className="absolute right-[18px] top-[20px] h-[260px] w-[62px] rounded-full bg-[rgba(165,160,202,0.18)] blur-2xl sm:right-[22px] sm:top-0 sm:h-[289px] sm:w-[70px]" />
        <div className="absolute right-[44px] top-[40px] h-[220px] w-[22px] rounded-full bg-[rgba(165,160,202,0.18)] blur-xl sm:right-[48px] sm:top-0 sm:h-[241px] sm:w-[23px]" />
      </div>

      {/* Group 308 — kanan tengah */}
      <div className="absolute right-[-2%] top-[12%] sm:right-[6%] md:right-[10%] lg:right-[max(2rem,calc((100%-72rem)/2+3rem))]">
        <div className="h-[300px] w-[92px] rounded-full bg-[rgba(136,183,168,0.5)] blur-3xl sm:h-[338px] sm:w-[100px] lg:h-[380px] lg:w-[120px]" />
        <div className="absolute right-[22px] top-[28px] h-[260px] w-[48px] rounded-full bg-[rgba(243,113,53,0.45)] blur-2xl sm:right-[26px] sm:top-[26px] sm:h-[290px] sm:w-[53px]" />
        <div className="absolute right-[46px] top-[52px] h-[230px] w-[6px] rounded-full bg-[rgba(243,113,53,0.42)] blur-lg opacity-90 sm:right-[52px] sm:top-[53px] sm:h-[242px] sm:w-[5px]" />
      </div>
    </div>
  );
}

/**
 * Hero atmosphere: full-bleed washes (readable on motion-reduce) + Figma-style soft blurs.
 * On lg+, blurs span the section so the headline column is not left visually flat.
 */
function HeroFigmaDecor() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {/* Base wash — always on */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#eef2ff] via-[#fafbff] to-[#e8f3fc]" />
      <div className="absolute inset-y-0 left-0 w-[min(74%,560px)] bg-gradient-to-r from-[rgba(165,160,202,0.28)] via-[rgba(175,168,210,0.12)] to-transparent lg:w-[52%]" />
      <div className="absolute inset-y-0 right-0 w-[min(82%,640px)] bg-gradient-to-l from-[rgba(112,165,245,0.22)] via-[rgba(198,222,255,0.14)] to-transparent lg:w-[58%]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_90%_60%_at_50%_-8%,rgba(165,160,202,0.32),transparent_58%)] opacity-90" />
      <div className="absolute inset-x-0 bottom-0 h-[min(52%,440px)] bg-gradient-to-t from-[rgba(252,249,239,0.55)] to-transparent" />

      {/* Soft sun-warm accent behind illustration side (desktop) */}
      <div className="absolute bottom-[-20%] right-[-10%] h-[min(380px,48vh)] w-[min(420px,55vw)] rounded-full bg-[rgba(255,188,140,0.22)] blur-3xl sm:right-0 lg:bottom-[-12%] lg:right-[2%] lg:h-[min(440px,52vh)] lg:w-[min(520px,42vw)]" />

      {/* Blur ornaments: centered ~430 on small screens; full section width on lg+ */}
      <div className="absolute inset-y-0 left-1/2 w-full max-w-[430px] -translate-x-1/2 overflow-hidden sm:max-w-[min(480px,94vw)] lg:left-0 lg:max-w-none lg:translate-x-0">
        <div className="absolute inset-0 overflow-hidden motion-reduce:hidden">
          {/* Vector 5 — widens with viewport on lg */}
          <div className="absolute inset-x-0 top-[-18%] flex justify-center lg:inset-x-[6%] lg:top-[-15%]">
            <div className="h-[min(524px,78vh)] w-full max-w-[min(430px,92vw)] rounded-[42%] bg-[rgb(165,160,202)] blur-[100px] sm:blur-[160px] md:blur-[200px] lg:max-w-[min(1040px,88vw)] lg:blur-[220px]" />
          </div>

          {/* Group 309 — kiri bawah */}
          <div className="absolute bottom-[-10%] left-[-14%] sm:left-[-8%] md:left-0 lg:left-[max(0.5rem,calc((100%-72rem)/2-2rem))]">
            <div className="absolute left-0 top-0 h-[312px] w-[171px] rounded-full bg-[rgba(136,183,168,0.55)] blur-3xl lg:h-[340px] lg:w-[200px]" />
            <div className="absolute left-0 top-[52px] h-[261px] w-[120px] rounded-full bg-[rgba(145,194,179,0.9)] blur-2xl lg:h-[288px] lg:w-[140px]" />
            <div className="absolute left-0 top-[99px] h-[213px] w-[73px] rounded-full bg-[rgba(145,194,179,0.9)] blur-xl opacity-95 lg:h-[236px] lg:w-[86px]" />
          </div>

          {/* Group 307 — kanan atas */}
          <div className="absolute right-[-8%] top-[5%] sm:right-0 md:right-[2%] lg:right-[max(0.5rem,calc((100%-72rem)/2-0.5rem))]">
            <div className="absolute right-0 top-0 h-[336px] w-[118px] rounded-full bg-[rgba(165,160,202,0.22)] blur-3xl lg:h-[380px] lg:w-[140px]" />
            <div className="absolute right-[22px] top-[24px] h-[289px] w-[70px] rounded-full bg-[rgba(165,160,202,0.2)] blur-2xl" />
            <div className="absolute right-[48px] top-[48px] h-[241px] w-[23px] rounded-full bg-[rgba(165,160,202,0.2)] blur-xl" />
          </div>

          {/* Group 308 — kanan tengah */}
          <div className="absolute right-[-6%] top-[12%] sm:right-[2%] md:right-[4%] lg:right-[max(1rem,calc((100%-72rem)/2+1rem))]">
            <div className="absolute right-0 top-0 h-[338px] w-[100px] rounded-full bg-[rgba(136,183,168,0.55)] blur-3xl lg:h-[380px] lg:w-[120px]" />
            <div className="absolute right-[26px] top-[26px] h-[290px] w-[53px] rounded-full bg-[rgba(145,194,179,0.9)] blur-2xl" />
            <div className="absolute right-[52px] top-[52px] h-[242px] w-[5px] rounded-full bg-[rgba(145,194,179,0.9)] blur-lg opacity-90" />
          </div>
        </div>
      </div>
    </div>
  );
}

function StatDonut({
  valueLabel,
  ariaLabel,
  showValueInCenter = true,
}: {
  valueLabel: string;
  ariaLabel: string;
  /** When false, render the stat label below the chart instead of inside the ring. */
  showValueInCenter?: boolean;
}) {
  return (
    <div
      role="img"
      aria-label={ariaLabel}
      className="relative mx-auto size-[115px] shrink-0 rounded-full p-3 sm:size-[135px] sm:p-[14px] md:size-[145px] md:p-4"
      style={{
        background:
          "conic-gradient(from -90deg, #5794f6 0 75%, #e5e7eb 75% 100%)",
      }}
    >
      <div className="flex size-full items-center justify-center rounded-full bg-white">
        {showValueInCenter ? (
          <p
            className="text-xl font-medium text-primary sm:text-2xl md:text-[1.75rem]"
            aria-hidden
          >
            {valueLabel}
          </p>
        ) : null}
      </div>
    </div>
  );
}

