import { useTranslations } from "next-intl";

export function Footer() {
  const t = useTranslations("footer");
  const currentYear = new Date().getFullYear();

  return (
    <footer
      role="contentinfo"
      className="border-t border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950"
    >
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <p className="text-center text-sm text-zinc-600 dark:text-zinc-400">
          {t("tagline")}
        </p>
        <p className="mt-2 text-center text-xs text-zinc-500 dark:text-zinc-500">
          {t("copyright", { year: currentYear })}
        </p>
      </div>
    </footer>
  );
}
