import React, { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { LanguageSwitcher } from "@/components/start/LanguageSwitcher";
import { AtomIcon } from "@/components/ui/atom";
import { AirplaneIcon } from "@/components/ui/airplane";
import { GraduationCapIcon } from "@/components/ui/graduation-cap";
import { cn } from "@/lib/utils";
import { getNextHeaderHiddenState } from "@/components/landing/stickyHeader";
import { PillTag } from "@/components/landing/PillTag";
import MagicBento, { type MagicBentoItem } from "@/components/start/landing/MagicBento";
import { LocaleLink } from "@/i18n/start-navigation";
import { renderAccent } from "@/components/start/rich-text";
import { m } from "@/paraglide/messages";

const JOURNEY_STEP_STYLES = [
  { panel: "bg-blue-ocean", text: "text-ink", muted: "!text-ink/60" },
  { panel: "bg-yellow-sun-deep", text: "text-ink", muted: "!text-ink/60" },
  { panel: "bg-green-leaf", text: "text-ink", muted: "!text-ink/60" },
  { panel: "bg-pink-bloom", text: "text-ink", muted: "!text-ink/60" },
  { panel: "bg-lavender-mist", text: "text-ink", muted: "!text-ink/60" },
] as const;

const JOURNEY_IMAGES = [
  "/images/journey/step1.webp",
  "/images/journey/step2.webp",
  "/images/journey/step3.webp",
  "/images/journey/step4.webp",
  "/images/journey/step5.webp",
] as const;

const TAG_STYLES = [
  "bg-yellow-sun-deep",
  "bg-yellow-sun-light",
  "bg-green-leaf",
  "bg-blue-ocean-light",
  "bg-yellow-sun-deep",
] as const;

/** Key Features bento — hero + wide + 2 squares, with brand accent bars */
const FEATURE_BENTO_LAYOUT = [
  {
    id: "talentScout" as const,
    image: "/images/features/talent-scout.webp",
    accentClassName: "text-yellow-sun-deep",
    size: "hero" as const,
  },
  {
    id: "questBuddy" as const,
    image: "/images/features/quest-buddy.webp",
    accentClassName: "text-blue-ocean-light",
    size: "wide" as const,
  },
  {
    id: "squadGallery" as const,
    image: "/images/features/squad-gallery.webp",
    accentClassName: "text-pink-bloom",
    size: "square" as const,
  },
  {
    id: "parentBridge" as const,
    image: "/images/features/parent-bridge.webp",
    accentClassName: "text-lavender-mist",
    size: "square" as const,
  },
] as const;

// Static map for dynamic feature bento keys — paraglide has no dynamic key lookup
const FEATURE_TEXTS = {
  talentScout: {
    imageAlt: m.landing_features_talentScout_imageAlt,
    title: m.landing_features_talentScout_title,
    body: m.landing_features_talentScout_body,
  },
  questBuddy: {
    imageAlt: m.landing_features_questBuddy_imageAlt,
    title: m.landing_features_questBuddy_title,
    body: m.landing_features_questBuddy_body,
  },
  squadGallery: {
    imageAlt: m.landing_features_squadGallery_imageAlt,
    title: m.landing_features_squadGallery_title,
    body: m.landing_features_squadGallery_body,
  },
  parentBridge: {
    imageAlt: m.landing_features_parentBridge_imageAlt,
    title: m.landing_features_parentBridge_title,
    body: m.landing_features_parentBridge_body,
  },
} as const;

export function HomeLanding() {
  const [isHeaderHidden, setIsHeaderHidden] = useState(false);
  const landingRef = useRef<HTMLDivElement>(null);
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

  useEffect(() => {
    const landingElement = landingRef.current;
    const prefersReducedMotion =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (!landingElement || prefersReducedMotion) {
      return;
    }

    const animationContext = gsap.context(() => {
      gsap.from("[data-hero-copy]", {
        autoAlpha: 0,
        y: 20,
        duration: 0.72,
        ease: "power3.out",
        stagger: 0.1,
      });
      gsap.from("[data-hero-visual]", {
        autoAlpha: 0,
        y: 28,
        scale: 0.98,
        duration: 0.86,
        ease: "power3.out",
        delay: 0.12,
      });
    }, landingElement);

    return () => {
      animationContext.revert();
    };
  }, []);

  const journeySteps = [
    m.landing_journey_step1_title(),
    m.landing_journey_step2_title(),
    m.landing_journey_step3_title(),
    m.landing_journey_step4_title(),
    m.landing_journey_step5_title(),
  ];
  const journeyBodies = [
    m.landing_journey_step1_body(),
    m.landing_journey_step2_body(),
    m.landing_journey_step3_body(),
    m.landing_journey_step4_body(),
    m.landing_journey_step5_body(),
  ];

  const tags = [
    m.landing_community_tagEco(),
    m.landing_community_tagTiny(),
    m.landing_community_tagStory(),
    m.landing_community_tagMini(),
    m.landing_community_tagDesign(),
  ];

  const communityBoxes = [
    {
      key: "art",
      Icon: GraduationCapIcon,
      bg: "bg-yellow-sun-deep",
      iconClass: "text-white",
      alt: m.landing_community_boxArtAlt(),
    },
    {
      key: "science",
      Icon: AtomIcon,
      bg: "bg-yellow-sun-light",
      iconClass: "text-white",
      alt: m.landing_community_boxScienceAlt(),
    },
    {
      key: "mobility",
      Icon: AirplaneIcon,
      bg: "bg-blue-ocean-light",
      iconClass: "text-white",
      alt: m.landing_community_boxMobilityAlt(),
    },
  ] as const;

  const navLinkClass =
    "inline-flex min-h-[44px] min-w-[44px] max-w-full items-center justify-center rounded-lg px-3 text-xs font-medium text-foreground transition-colors hover:bg-muted md:px-3 md:text-sm";

  const shell =
    "mx-auto w-full max-w-6xl px-4 sm:px-6 md:px-8 lg:px-10 xl:max-w-6xl";
  const heroShell = "mx-auto w-full px-4 sm:px-6 lg:px-0";
  const shellNarrow =
    "mx-auto w-full max-w-2xl px-4 sm:px-6 md:px-8 lg:px-10";

  const bentoItems: MagicBentoItem[] = FEATURE_BENTO_LAYOUT.map((entry) => ({
    id: entry.id,
    image: entry.image,
    imageAlt: FEATURE_TEXTS[entry.id].imageAlt(),
    title: FEATURE_TEXTS[entry.id].title(),
    description: FEATURE_TEXTS[entry.id].body(),
    accentClassName: entry.accentClassName,
    size: entry.size,
  }));

  return (
    <div
      ref={landingRef}
      className="landing-light min-h-screen bg-background font-sans text-foreground"
    >
      {/* Top bar — sheet on small screens; inline nav md+ */}
      <header
        className={cn(
          "sticky top-0 z-40 w-full border-b border-border/60 bg-background/95 py-3 backdrop-blur-sm transition-transform duration-300 sm:py-3.5",
          isHeaderHidden && "-translate-y-full",
        )}
      >
        <div className={cn(shell, "flex items-center justify-between gap-4")}>
          <LocaleLink href="/" className="flex min-w-0 items-center gap-2.5">
            <img
              src="/images/katalis-logo.webp"
              alt=""
              width={44}
              height={44}
              className="size-10 shrink-0 object-contain sm:size-11"
              aria-hidden
            />
            <span className="font-rubik truncate text-base font-medium text-foreground sm:text-lg">
              {m.landing_brandName()}
            </span>
          </LocaleLink>
          <nav
            aria-label="Main"
            className="hidden min-w-0 flex-1 items-center justify-end gap-1 md:flex lg:gap-2"
          >
            <LocaleLink href="/discover" className={navLinkClass}>
              {m.nav_discover()}
            </LocaleLink>
            <LocaleLink href="/quest" className={navLinkClass}>
              {m.nav_quest()}
            </LocaleLink>
            <LocaleLink href="/gallery" className={navLinkClass}>
              {m.nav_gallery()}
            </LocaleLink>
            <LocaleLink href="/login" className={navLinkClass}>
              {m.nav_login()}
            </LocaleLink>
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
                  aria-label={m.landing_openMenu()}
                >
                  <Menu className="size-6" strokeWidth={1.5} />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[min(100%,320px)]">
                <SheetHeader>
                  <SheetTitle>{m.landing_navSheetTitle()}</SheetTitle>
                </SheetHeader>
                <nav className="mt-6 flex flex-col gap-1 px-1" aria-label="Mobile">
                  <LocaleLink href="/discover" className={navLinkClass}>
                    {m.nav_discover()}
                  </LocaleLink>
                  <LocaleLink href="/quest" className={navLinkClass}>
                    {m.nav_quest()}
                  </LocaleLink>
                  <LocaleLink href="/gallery" className={navLinkClass}>
                    {m.nav_gallery()}
                  </LocaleLink>
                  <LocaleLink href="/login" className={navLinkClass}>
                    {m.nav_login()}
                  </LocaleLink>
                  <div className="mt-4 border-t border-border pt-4">
                    <LanguageSwitcher />
                  </div>
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      <section
        className="relative min-h-[calc(100svh-65px)] w-full overflow-hidden bg-blue-ocean-light/15 pb-10 pt-2 sm:min-h-[calc(100svh-73px)] sm:pb-12 sm:pt-4 lg:pb-0 lg:pt-0"
        aria-labelledby="hero-heading"
      >
        <div className="relative z-10 min-h-[calc(100svh-65px)] sm:min-h-[calc(100svh-73px)]">
          <div
            className={`${heroShell} relative z-10 lg:grid lg:min-h-[calc(100svh-73px)] lg:grid-cols-2 lg:items-center lg:gap-0 lg:pb-0 lg:pt-0`}
          >
            <div className="mx-auto w-full max-w-[430px] pb-6 pt-6 text-center sm:max-w-[520px] lg:max-w-[540px] lg:px-10 lg:pb-0 lg:pt-0 lg:text-left xl:px-12">
              <h1
                id="hero-heading"
                data-hero-copy
                className="type-h1 mx-auto max-w-[18rem] [text-wrap:wrap] lg:mx-0 lg:max-w-none lg:[text-wrap:balance]"
              >
                {renderAccent(
                  m.landing_hero_title(),
                  (c) => <span className="text-yellow-sun-deep">{c}</span>,
                )}
              </h1>
              <p
                data-hero-copy
                className="type-lede mx-auto mt-4 max-w-[280px] sm:max-w-md lg:mx-0 lg:max-w-none"
              >
                {m.landing_hero_subtitle()}
              </p>
              <LocaleLink
                href="/discover"
                data-hero-copy
                className="group/button relative z-20 mx-auto mt-6 inline-flex h-[56px] w-full max-w-[430px] items-center justify-center overflow-hidden rounded-full bg-yellow-sun-deep px-6 text-xl font-bold text-primary-foreground shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-yellow-sun-deep lg:mx-0 lg:max-w-[360px]"
              >
                <span>{m.landing_hero_cta()}</span>
                <div className="absolute inset-0 flex h-full w-full justify-center transition-transform duration-300 ease-in-out [transform:skew(-13deg)_translateX(-100%)] group-hover/button:duration-1000 group-hover/button:[transform:skew(-13deg)_translateX(100%)]">
                  <div className="relative h-full w-10 bg-white/30" />
                </div>
              </LocaleLink>
            </div>
          </div>

          {/* Hero image */}
          <div className="relative z-10 mx-auto w-[calc(100%-2rem)] max-w-[430px] pb-8 sm:w-[calc(100%-3rem)] sm:max-w-[640px] lg:absolute lg:inset-y-0 lg:right-0 lg:mx-0 lg:w-1/2 lg:max-w-none lg:pb-0">
            <div
              className="relative overflow-hidden rounded-2xl lg:h-full lg:rounded-none lg:rounded-bl-3xl"
              data-hero-visual
            >
              <div className="relative aspect-[4/3] w-full sm:aspect-[16/11] lg:h-full lg:min-h-[calc(100svh-73px)] lg:aspect-auto">
                <img
                  src="/images/landing-hero-generated.webp"
                  alt={m.landing_hero_imageAlt()}
                  className="absolute inset-0 h-full w-full object-cover object-[center_58%]"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="h-16 bg-blue-ocean-light/15 sm:h-20" aria-hidden />

      {/* Journey — full-vw sticky sections (image left, text right) */}
      <section
        className="relative w-full"
        aria-labelledby="journey-heading"
      >
        {/* Cloud content — top SVG pokes upward into previous section (no gray band) */}
        <div className="relative bg-white py-10 sm:py-14">
          <svg
            viewBox="0 0 1440 80"
            preserveAspectRatio="none"
            className="absolute inset-x-0 top-0 h-10 w-full -translate-y-full sm:h-16"
            aria-hidden
          >
            <path
              d="M0,80 L0,52 C90,12 180,72 270,46 C360,20 450,70 540,46 C630,22 720,70 810,46 C900,22 990,70 1080,46 C1170,22 1260,66 1440,46 L1440,80 Z"
              fill="white"
            />
          </svg>
          <div className={cn(shell, "text-center")}>
            <p id="journey-eyebrow" className="type-kicker">
              {m.landing_journey_eyebrow()}
            </p>
            <h2 id="journey-heading" className="type-h2 mt-2">
              {m.landing_journey_titleBefore()}
              <strong className="font-normal">{m.landing_journey_titleEmphasis()}</strong>
              {m.landing_journey_titleAfter()}
            </h2>
          </div>
        </div>

        {/* Bottom cloud edge: white cloud hangs down into bg-blue-ocean */}
        <div className="bg-white">
          <svg
            viewBox="0 0 1440 80"
            preserveAspectRatio="none"
            className="block h-10 w-full sm:h-16"
            aria-hidden
          >
            <path
              d="M0,80 L0,36 C90,74 180,18 270,46 C360,74 450,18 540,44 C630,70 720,16 810,44 C900,72 990,18 1080,44 C1170,70 1260,22 1440,44 L1440,80 Z"
              fill="#619bf7"
            />
          </svg>
        </div>

        {/* Each step is sticky; higher z-index steps slide up and cover lower ones */}
        {journeySteps.map((title, i) => {
          const styles = JOURNEY_STEP_STYLES[i];
          return (
            <div
              key={title}
              className="sticky top-0 grid h-screen w-full overflow-hidden grid-rows-[1fr_1fr] lg:grid-cols-2 lg:grid-rows-1"
              style={{ zIndex: 10 + i }}
            >
              {/* Image — top on mobile, left on desktop */}
              <div className="relative overflow-hidden">
                <img
                  src={JOURNEY_IMAGES[i] ?? ""}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover"
                  aria-hidden
                />
              </div>

              {/* Text — bottom on mobile, right on desktop */}
              <div
                className={cn(
                  "flex flex-col justify-center px-8 py-8 lg:px-16 lg:py-20",
                  styles?.panel,
                  styles?.text,
                )}
              >
                <p className={cn("type-kicker mb-3", styles?.muted)}>
                  {m.landing_journey_eyebrow()} · 0{i + 1}
                </p>
                <h3 className="type-h2 leading-tight">{title}</h3>
                <p className={cn("type-lede mt-4 max-w-sm", styles?.muted)}>
                  {journeyBodies[i]}
                </p>
              </div>
            </div>
          );
        })}

        {/* Thin cloud strip: lavender-mist → bg-background. z-[25] paints above features (z-20) */}
        <div className="relative z-[25] h-10 sm:h-14 bg-background" aria-hidden>
          <svg
            viewBox="0 0 1440 56"
            preserveAspectRatio="none"
            className="absolute inset-0 h-full w-full"
          >
            <path
              d="M0,0 L0,28 C120,50 240,6 360,28 C480,52 600,6 720,28 C840,52 960,6 1080,28 C1200,52 1320,8 1440,28 L1440,0 Z"
              fill="#a5a0ca"
            />
          </svg>
        </div>
      </section>

      {/* Key features — MagicBento (image-led, max 1 viewport on lg+) */}
      <section className="relative z-20 mt-16 w-full bg-background py-10 sm:mt-20 sm:py-12 lg:flex lg:h-screen lg:max-h-screen lg:flex-col lg:overflow-hidden lg:py-8">
        <div className={cn(shell, "flex h-full min-h-0 flex-col")}>
          <div className="mx-auto max-w-xl text-center">
            <p className="type-kicker">{m.landing_features_eyebrow()}</p>
            <h2 className="type-h2 mt-2">
              {renderAccent(
                m.landing_features_title(),
                (c) => <strong className="font-normal text-ink">{c}</strong>,
              )}
            </h2>
          </div>

          <div className="mt-6 flex min-h-0 flex-1 sm:mt-8">
            <MagicBento
              items={bentoItems}
              textAutoHide
              enableStars
              enableSpotlight
              enableBorderGlow
              enableTilt
              enableMagnetism
              clickEffect
              spotlightRadius={320}
              particleCount={10}
              glowColor="246, 169, 38"
            />
          </div>
        </div>
      </section>

      {/* Community */}
      <section className="relative z-20 mt-16 w-full bg-background py-12 sm:mt-20 sm:py-14">
        <div className={shell}>
          <p className="type-kicker text-center">
            {m.landing_community_eyebrow()}
          </p>
          <h2 className="type-h2 mt-2 text-center md:mx-auto md:max-w-2xl">
            {m.landing_community_title()}
          </h2>
          <div className="mt-8 flex flex-wrap justify-center gap-2 sm:gap-3">
            {tags.map((tag, i) => (
              <PillTag
                key={tag}
                label={tag}
                className={cn(
                  "text-primary-foreground",
                  TAG_STYLES[i % TAG_STYLES.length],
                )}
              />
            ))}
          </div>
          <div className="mx-auto mt-8 flex max-w-[360px] flex-wrap justify-center gap-3 sm:max-w-none sm:gap-4 md:gap-6 lg:mt-10">
            {communityBoxes.map((box) => (
              <div
                key={box.key}
                role="img"
                aria-label={box.alt}
                className={cn(
                  "flex size-[100px] items-center justify-center rounded-2xl sm:size-[110px] md:size-32 lg:size-36",
                  box.bg,
                )}
              >
                {React.createElement(box.Icon, {
                  size: 88,
                  className: cn(
                    "[&_svg]:size-[64px] sm:[&_svg]:size-[72px] md:[&_svg]:size-[88px] lg:[&_svg]:size-[104px]",
                    box.iconClass,
                  ),
                })}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="relative z-20 mt-16 w-full bg-yellow-sun-light/30 py-14 sm:mt-20 sm:py-16">
        <div className={`${shellNarrow} flex flex-col items-center text-center`}>
          <h2 className="type-h2 max-w-[min(100%,320px)] sm:max-w-none">
            {m.landing_closing_title()}
          </h2>
          <div className="mt-8 flex w-full max-w-[420px] flex-col gap-3 sm:max-w-lg sm:flex-row sm:justify-center md:max-w-2xl">
            <Button
              asChild
              className="group/button relative h-[52px] w-full shrink-0 overflow-hidden rounded-2xl border-0 bg-gradient-to-r from-yellow-sun-deep to-yellow-sun-light text-lg font-bold !text-primary-foreground sm:flex-1 sm:text-xl md:max-w-[280px]"
            >
              <LocaleLink href="/discover">
                <span>{m.landing_closing_primaryCta()}</span>
                <div className="absolute inset-0 flex h-full w-full justify-center transition-transform duration-300 ease-in-out [transform:skew(-13deg)_translateX(-100%)] group-hover/button:duration-1000 group-hover/button:[transform:skew(-13deg)_translateX(100%)]">
                  <div className="relative h-full w-10 bg-white/30" />
                </div>
              </LocaleLink>
            </Button>
          </div>
        </div>
      </section>

      {/* Footer strip */}
      <footer className="relative z-20 w-full border-t border-border bg-white py-10 text-center sm:py-12">
        <div className={shell}>
          <p className="type-p mx-auto max-w-md text-sm text-muted-foreground sm:text-base">
            {m.landing_closing_footerLine1()}
          </p>
          <nav
            aria-label={m.landing_closing_footerNavLabel()}
            className="mx-auto mt-4 flex max-w-md flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm"
          >
            <LocaleLink
              href="/privacy"
              className="text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
            >
              {m.landing_closing_footerPrivacy()}
            </LocaleLink>
            <span className="text-border" aria-hidden>
              ·
            </span>
            <LocaleLink
              href="/terms"
              className="text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
            >
              {m.landing_closing_footerTerms()}
            </LocaleLink>
            <span className="text-border" aria-hidden>
              ·
            </span>
            <LocaleLink
              href="/contact"
              className="text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
            >
              {m.landing_closing_footerContact()}
            </LocaleLink>
          </nav>
        </div>
      </footer>
    </div>
  );
}
