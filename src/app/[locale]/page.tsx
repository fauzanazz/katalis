import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Search, Rocket, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";

const PILLAR_ICONS = [Search, Rocket, Globe] as const;
const PILLAR_KEYS = ["discover", "act", "connect"] as const;

export default function LandingPage() {
  const t = useTranslations();

  return (
    <div className="flex flex-col">
      {/* Hero section */}
      <section
        aria-labelledby="hero-heading"
        className="flex flex-col items-center justify-center bg-zinc-50 px-4 py-20 sm:py-28 dark:bg-zinc-950"
      >
        <div className="mx-auto w-full max-w-3xl text-center">
          <h1
            id="hero-heading"
            className="text-4xl font-bold tracking-tight text-zinc-900 sm:text-5xl dark:text-zinc-50"
          >
            {t("landing.hero.title")}
          </h1>
          <p className="mt-4 text-lg text-zinc-600 dark:text-zinc-400">
            {t("landing.hero.subtitle")}
          </p>
          <div className="mt-8">
            <Button asChild size="lg" className="h-12 rounded-full px-8 text-base">
              <Link href="/login">{t("landing.hero.cta")}</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Three pillars */}
      <section
        aria-labelledby="pillars-heading"
        className="bg-white px-4 py-16 sm:py-20 dark:bg-zinc-900"
      >
        <h2 id="pillars-heading" className="sr-only">
          {t("common.appName")}
        </h2>
        <div className="mx-auto grid max-w-5xl gap-8 sm:grid-cols-3 sm:gap-12">
          {PILLAR_KEYS.map((key, index) => {
            const Icon = PILLAR_ICONS[index];
            return (
              <div
                key={key}
                className="flex flex-col items-center text-center"
              >
                <div className="flex size-14 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
                  <Icon className="size-7 text-zinc-700 dark:text-zinc-300" />
                </div>
                <h3 className="mt-4 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
                  {t(`landing.pillars.${key}.title`)}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                  {t(`landing.pillars.${key}.description`)}
                </p>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
