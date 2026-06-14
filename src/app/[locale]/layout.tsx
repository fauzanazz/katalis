import type { Metadata } from "next";
import {
  Instrument_Sans,
  Luckiest_Guy,
  Montserrat,
  Schoolbell,
} from "next/font/google";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { getSession } from "@/lib/auth";
import { LocaleShell } from "@/components/layout/LocaleShell";
import { Toaster } from "@/components/ui/sonner";

const instrumentSans = Instrument_Sans({
  variable: "--font-instrument-sans",
  subsets: ["latin"],
});

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
});

const luckiestGuy = Luckiest_Guy({
  variable: "--font-luckiest-guy",
  subsets: ["latin"],
  weight: "400",
});

const schoolbell = Schoolbell({
  variable: "--font-schoolbell",
  subsets: ["latin"],
  weight: "400",
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "metadata" });
  return {
    title: t("title"),
    description: t("description"),
  };
}

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
    <html
      lang={locale}
      className={`${instrumentSans.variable} ${montserrat.variable} ${luckiestGuy.variable} ${schoolbell.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col font-sans">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <div className="flex min-h-dvh flex-col">
            <LocaleShell isAuthenticated={isAuthenticated} isAdmin={isAdmin} isParent={isParent}>{children}</LocaleShell>
          </div>
        </NextIntlClientProvider>
        <Toaster />
      </body>
    </html>
  );
}
