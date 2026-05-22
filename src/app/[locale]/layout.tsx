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
  const isAuthenticated = !!(session?.childId || session?.userId);
  const isAdmin = session?.type === "user" && session?.role === "admin";
  const isParent = session?.type === "user" && session?.role === "user";

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <div className="flex min-h-dvh flex-col">
        <LocaleShell isAuthenticated={isAuthenticated} isAdmin={isAdmin} isParent={isParent}>{children}</LocaleShell>
      </div>
    </NextIntlClientProvider>
  );
}
