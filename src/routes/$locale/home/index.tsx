import { createFileRoute, redirect } from "@tanstack/react-router";
import { ArrowRight, Compass, Images, Sparkles } from "lucide-react";
import { m } from "@/paraglide/messages";
import { LocaleLink } from "@/i18n/start-navigation";
import { KidPageShell } from "@/components/layout/KidPageShell";
import { getAuthSessionFn } from "@/lib/server/auth";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getDayPart(): "morning" | "afternoon" | "evening" {
  const hour = new Date().getHours();
  if (hour < 11) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}

const CARD_COLORS = {
  discover: "bg-[#A8C8F0]",
  quest: "bg-[#C8A4E0]",
  gallery: "bg-white",
} as const;

const CARD_TITLES = {
  discover: m.childHome_cards_discover_title,
  quest: m.childHome_cards_quest_title,
  gallery: m.childHome_cards_gallery_title,
} as const;

const CARD_DESCRIPTIONS = {
  discover: m.childHome_cards_discover_description,
  quest: m.childHome_cards_quest_description,
  gallery: m.childHome_cards_gallery_description,
} as const;

const GREETING_NAMED = {
  morning: m.childHome_greetingNamedMorning,
  afternoon: m.childHome_greetingNamedAfternoon,
  evening: m.childHome_greetingNamedEvening,
} as const;

const GREETING_ANON = {
  morning: m.childHome_greetingAnonMorning,
  afternoon: m.childHome_greetingAnonAfternoon,
  evening: m.childHome_greetingAnonEvening,
} as const;

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------

export const Route = createFileRoute("/$locale/home/")({
  head: () => ({
    meta: [{ title: m.childHome_kicker() }],
  }),
  loader: async ({ params }): Promise<{ childName: string | null; dayPart: "morning" | "afternoon" | "evening" }> => {
    const s = await getAuthSessionFn();
    if (!s.authenticated || s.mode !== "child") {
      const dest = s.authenticated && s.hasParent
        ? `/${params.locale}/parent`
        : `/${params.locale}/login`;
      throw redirect({ href: dest });
    }
    return {
      childName: s.childName,
      dayPart: getDayPart(),
    };
  },
  component: ChildHomePage,
});

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const CARDS = [
  { href: "/discover", key: "discover" as const, Icon: Compass },
  { href: "/quest", key: "quest" as const, Icon: Sparkles },
  { href: "/gallery", key: "gallery" as const, Icon: Images },
];

function ChildHomePage() {
  const { childName, dayPart } = Route.useLoaderData();

  const greeting = childName
    ? GREETING_NAMED[dayPart]({ name: childName })
    : GREETING_ANON[dayPart]();

  return (
    <KidPageShell
      kicker={m.childHome_kicker()}
      title={greeting}
      subtitle={m.childHome_subtitle()}
    >
      <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {CARDS.map(({ href, key, Icon }) => (
          <li key={key}>
            <LocaleLink
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
                {CARD_TITLES[key]()}
              </h2>
              <p className="mt-1 text-sm font-semibold text-black/65">
                {CARD_DESCRIPTIONS[key]()}
              </p>
              <span className="mt-5 inline-flex items-center gap-1 text-sm font-bold text-black/70 transition-transform group-hover:translate-x-1">
                {m.childHome_cta()}
                <ArrowRight className="size-4" aria-hidden />
              </span>
            </LocaleLink>
          </li>
        ))}
      </ul>
    </KidPageShell>
  );
}
