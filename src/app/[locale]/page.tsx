import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export default function LandingPage() {
  const t = useTranslations();

  return (
    <main
      role="main"
      className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-4 py-16 dark:bg-black"
    >
      <div className="mx-auto w-full max-w-3xl text-center">
        <h1 className="text-4xl font-bold tracking-tight text-zinc-900 sm:text-5xl dark:text-zinc-50">
          {t("landing.hero.title")}
        </h1>
        <p className="mt-4 text-lg text-zinc-600 dark:text-zinc-400">
          {t("landing.hero.subtitle")}
        </p>
        <div className="mt-8">
          <Link
            href="/login"
            className="inline-flex h-12 items-center justify-center rounded-full bg-zinc-900 px-8 text-base font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {t("landing.hero.cta")}
          </Link>
        </div>
      </div>
    </main>
  );
}
