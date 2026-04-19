import { useTranslations } from "next-intl";

export function Footer() {
  const t = useTranslations("footer");
  const currentYear = new Date().getFullYear();

  return (
    <footer
      role="contentinfo"
      className="border-t border-border bg-background"
    >
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <p className="text-center text-sm text-muted-foreground">
          {t("tagline")}
        </p>
        <p className="mt-2 text-center text-xs text-muted-foreground">
          {t("copyright", { year: currentYear })}
        </p>
      </div>
    </footer>
  );
}
