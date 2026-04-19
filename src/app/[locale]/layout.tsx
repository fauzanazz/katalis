import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getMessages } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { getSession } from "@/lib/auth";
import { LocaleShell } from "@/components/layout/LocaleShell";

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  const messages = await getMessages();
  const session = await getSession();
  const isAuthenticated = !!session?.childId;

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <div className="flex min-h-screen flex-col">
        <LocaleShell isAuthenticated={isAuthenticated}>{children}</LocaleShell>
      </div>
    </NextIntlClientProvider>
  );
}
