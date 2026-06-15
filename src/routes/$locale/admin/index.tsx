import { createFileRoute, redirect, notFound } from "@tanstack/react-router";
import { Users, Shield, Ticket, Sparkles, Swords, Image, ShieldAlert } from "lucide-react";
import { m } from "@/paraglide/messages";
import { LocaleLink } from "@/i18n/start-navigation";
import { getPlatformStatsFn } from "@/lib/server/admin-stats";

interface PlatformStats {
  totalUsers: number;
  totalChildren: number;
  activeCodes: number;
  totalDiscoveries: number;
  totalQuests: number;
  totalGalleryEntries: number;
  pendingModeration: number;
}

export const Route = createFileRoute("/$locale/admin/")({
  loader: async ({ params }): Promise<{ stats: PlatformStats }> => {
    const res = await getPlatformStatsFn();
    if (!res.ok) {
      if (res.error === "unauthorized") throw redirect({ href: `/${params.locale}/parent` });
      throw notFound();
    }
    return { stats: res };
  },
  component: AdminDashboardPage,
});

const STAT_CARDS = [
  { key: "totalUsers" as const, icon: Users, color: "text-blue-600" },
  { key: "totalChildren" as const, icon: Shield, color: "text-green-600" },
  { key: "activeCodes" as const, icon: Ticket, color: "text-purple-600" },
  { key: "totalDiscoveries" as const, icon: Sparkles, color: "text-amber-600" },
  { key: "totalQuests" as const, icon: Swords, color: "text-rose-600" },
  { key: "totalGalleryEntries" as const, icon: Image, color: "text-cyan-600" },
  { key: "pendingModeration" as const, icon: ShieldAlert, color: "text-red-600" },
] as const;

function AdminDashboardPage() {
  const { stats } = Route.useLoaderData();

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">{m.admin_title()}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{m.admin_subtitle()}</p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-7">
        {STAT_CARDS.map(({ key, icon: Icon, color }) => (
          <div
            key={key}
            className="rounded-xl border border-border/60 bg-background p-4"
          >
            <div className="flex items-center gap-2">
              <Icon className={`size-4 ${color}`} />
            </div>
            <p className="mt-2 text-2xl font-bold text-foreground">{stats[key]}</p>
            <p className="text-xs text-muted-foreground">{m[`admin_stats_${key}`]()}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <LocaleLink
          href="/admin/users"
          className="rounded-xl border border-border/60 bg-background p-6 transition-colors hover:bg-zinc-50"
        >
          <h2 className="font-semibold text-foreground">{m.admin_tabs_users()}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {stats.totalUsers} {m.admin_stats_totalUsers().toLowerCase()}
          </p>
        </LocaleLink>
        <LocaleLink
          href="/admin/codes"
          className="rounded-xl border border-border/60 bg-background p-6 transition-colors hover:bg-zinc-50"
        >
          <h2 className="font-semibold text-foreground">{m.admin_tabs_codes()}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {stats.activeCodes} {m.admin_stats_activeCodes().toLowerCase()}
          </p>
        </LocaleLink>
        <LocaleLink
          href="/admin/moderation"
          className="rounded-xl border border-border/60 bg-background p-6 transition-colors hover:bg-zinc-50"
        >
          <h2 className="font-semibold text-foreground">{m.admin_tabs_moderation()}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {stats.pendingModeration} {m.admin_stats_pendingModeration().toLowerCase()}
          </p>
        </LocaleLink>
        <LocaleLink
          href="/admin/reliability"
          className="rounded-xl border border-border/60 bg-background p-6 transition-colors hover:bg-zinc-50"
        >
          <h2 className="font-semibold text-foreground">Reliability</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            AI vs human Kappa
          </p>
        </LocaleLink>
      </div>
    </div>
  );
}
