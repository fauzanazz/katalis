import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "legal" });
  return {
    title: t("privacy.title"),
  };
}

export default async function PrivacyPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "legal" });

  return (
    <article className="mx-auto max-w-prose px-4 py-12 md:py-16">
      <h1 className="text-3xl font-semibold tracking-tight text-foreground">
        {t("privacy.title")}
      </h1>
      <p className="mt-6 leading-relaxed text-muted-foreground">{t("privacy.stub")}</p>
    </article>
  );
}
