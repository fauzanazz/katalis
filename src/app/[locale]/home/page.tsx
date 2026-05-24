import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { ArrowRight, Compass, Images, Sparkles } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { KidPageShell } from "@/components/layout/KidPageShell";
import { getChildSession, getUserSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { children } from "@/lib/schema";
import { eq } from "drizzle-orm";

const CARD_COLORS = {
  discover: "bg-[#A8C8F0]",
  quest: "bg-[#C8A4E0]",
  gallery: "bg-white",
} as const;

function getDayPart(date = new Date()): "morning" | "afternoon" | "evening" {
  const hour = date.getHours();
  if (hour < 11) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}

export default async function ChildHomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const childSession = await getChildSession();

  if (!childSession) {
    const user = await getUserSession();
    redirect(`/${locale}${user ? "/parent" : "/login"}`);
  }

  const child = await db.query.children.findFirst({
    where: eq(children.id, childSession.childId),
    columns: { name: true },
  });

  const t = await getTranslations("childHome");
  const name = child?.name?.trim();
  const dayPart = getDayPart();
  const greeting = name
    ? t("greetingNamed", { name, dayPart })
    : t("greetingAnon", { dayPart });

  const cards = [
    { href: "/discover", key: "discover", Icon: Compass },
    { href: "/quest", key: "quest", Icon: Sparkles },
    { href: "/gallery", key: "gallery", Icon: Images },
  ] as const;

  return (
    <KidPageShell
      kicker={t("kicker")}
      title={greeting}
      subtitle={t("subtitle")}
    >
      <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map(({ href, key, Icon }) => (
          <li key={key}>
            <Link
              href={href}
              className="group flex h-full flex-col rounded-2xl border-2 border-black bg-white p-6 shadow-[4px_4px_0_#000] transition-all hover:-translate-y-0.5 hover:shadow-[6px_6px_0_#000] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 active:translate-y-0 active:shadow-[2px_2px_0_#000]"
            >
              <span
                className={`mb-4 inline-flex size-12 items-center justify-center rounded-xl border-2 border-black ${CARD_COLORS[key]} shadow-[2px_2px_0_#000]`}
                aria-hidden
              >
                <Icon className="size-6 text-black" strokeWidth={2.25} />
              </span>
              <h2 className="text-2xl font-black tracking-tight text-black">
                {t(`cards.${key}.title`)}
              </h2>
              <p className="mt-1 text-sm font-semibold text-black/65">
                {t(`cards.${key}.description`)}
              </p>
              <span className="mt-5 inline-flex items-center gap-1 text-sm font-bold text-black/70 transition-transform group-hover:translate-x-1">
                {t("cta")}
                <ArrowRight className="size-4" aria-hidden />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </KidPageShell>
  );
}
