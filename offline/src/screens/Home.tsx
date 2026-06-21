import { useNavigate } from "@tanstack/react-router";
import { Award, Compass, Image, MessageCircle, UserRound } from "lucide-react";
import { m } from "@/paraglide/messages";
import { useApp } from "../app/context";
import { t } from "../data/types";
import { STR } from "../strings";

const TILES = [
  { to: "/discover" as const, icon: Compass, label: () => m.nav_discover(), tone: "bg-blue-ocean-light" },
  { to: "/badges" as const, icon: Award, label: () => m.badges_title(), tone: "bg-yellow-sun-light" },
  { to: "/gallery" as const, icon: Image, label: () => m.nav_gallery(), tone: "bg-green-leaf-light" },
  { to: "/mentor" as const, icon: MessageCircle, label: () => m.mentor_chatTitle(), tone: "bg-pink-bloom-soft" },
];

export function Home() {
  const { profile, locale } = useApp();
  const navigate = useNavigate();
  if (!profile) return null;

  return (
    <div className="flex flex-col gap-6 p-5">
      <header className="flex items-center justify-between pt-2">
        <div>
          <p className="text-sm text-muted-foreground">{t(STR.greeting, locale)}</p>
          <h1 className="type-h2 text-ink">
            {profile.emoji} {profile.name}
          </h1>
        </div>
        <button
          type="button"
          onClick={() => navigate({ to: "/profiles" })}
          className="flex size-11 items-center justify-center rounded-full bg-plain-surface text-muted-foreground shadow-sm"
          aria-label={t(STR.whoPlaying, locale)}
        >
          <UserRound className="size-5" aria-hidden />
        </button>
      </header>

      <button
        type="button"
        onClick={() => navigate({ to: "/discover" })}
        className="flex flex-col items-start gap-2 rounded-3xl bg-primary p-6 text-left text-primary-foreground shadow-md transition-transform active:scale-[0.98]"
      >
        <Compass className="size-8" aria-hidden />
        <span className="text-xl font-bold">{m.discover_title()}</span>
        <span className="text-sm opacity-90">{m.discover_subtitle()}</span>
      </button>

      <div className="grid grid-cols-2 gap-4">
        {TILES.map(({ to, icon: Icon, label, tone }) => (
          <button
            key={to}
            type="button"
            onClick={() => navigate({ to })}
            className={`flex flex-col items-start gap-3 rounded-2xl ${tone} p-5 text-left text-ink shadow-sm transition-transform active:scale-[0.98]`}
          >
            <Icon className="size-7" aria-hidden />
            <span className="font-semibold">{label()}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
