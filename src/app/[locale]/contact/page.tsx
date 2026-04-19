import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "legal" });
  return {
    title: t("contact.title"),
  };
}

export default async function ContactPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "legal" });

  return (
    <article className="mx-auto max-w-prose px-4 py-12 md:py-16">
      <h1 className="text-3xl font-semibold tracking-tight text-foreground">
        {t("contact.title")}
      </h1>
      <p className="mt-6 leading-relaxed text-muted-foreground">{t("contact.stub")}</p>
      <p className="mt-8">
        <a
          href={t("contact.emailHref")}
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          {t("contact.emailCta")}
        </a>
      </p>
    </article>
  );
}
