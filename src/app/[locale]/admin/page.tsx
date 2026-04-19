import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db";
import { Users, Shield, Ticket, Sparkles, Swords, Image } from "lucide-react";
import { Link } from "@/i18n/navigation";

interface StatsData {
  totalUsers: number;
  totalChildren: number;
  activeCodes: number;
  totalDiscoveries: number;
  totalQuests: number;
  totalGalleryEntries: number;
}

async function getStats(): Promise<StatsData> {
  const [totalUsers, totalChildren, activeCodes, totalDiscoveries, totalQuests, totalGalleryEntries] =
    await Promise.all([
      prisma.user.count(),
      prisma.child.count(),
      prisma.accessCode.count({ where: { active: true } }),
      prisma.discovery.count(),
      prisma.quest.count(),
      prisma.galleryEntry.count(),
    ]);
  return { totalUsers, totalChildren, activeCodes, totalDiscoveries, totalQuests, totalGalleryEntries };
}

export default async function AdminDashboardPage() {
  const t = await getTranslations("admin");
  const stats = await getStats();

  const statCards = [
    { key: "totalUsers", value: stats.totalUsers, icon: Users, color: "text-blue-600" },
    { key: "totalChildren", value: stats.totalChildren, icon: Shield, color: "text-green-600" },
    { key: "activeCodes", value: stats.activeCodes, icon: Ticket, color: "text-purple-600" },
    { key: "totalDiscoveries", value: stats.totalDiscoveries, icon: Sparkles, color: "text-amber-600" },
    { key: "totalQuests", value: stats.totalQuests, icon: Swords, color: "text-rose-600" },
    { key: "totalGalleryEntries", value: stats.totalGalleryEntries, icon: Image, color: "text-cyan-600" },
  ] as const;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {statCards.map(({ key, value, icon: Icon, color }) => (
          <div
            key={key}
            className="rounded-xl border border-border/60 bg-background p-4"
          >
            <div className="flex items-center gap-2">
              <Icon className={`size-4 ${color}`} />
            </div>
            <p className="mt-2 text-2xl font-bold text-foreground">{value}</p>
            <p className="text-xs text-muted-foreground">{t(`stats.${key}`)}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <Link
          href="/admin/users"
          className="rounded-xl border border-border/60 bg-background p-6 transition-colors hover:bg-zinc-50"
        >
          <h2 className="font-semibold text-foreground">{t("tabs.users")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {stats.totalUsers} {t("stats.totalUsers").toLowerCase()}
          </p>
        </Link>
        <Link
          href="/admin/codes"
          className="rounded-xl border border-border/60 bg-background p-6 transition-colors hover:bg-zinc-50"
        >
          <h2 className="font-semibold text-foreground">{t("tabs.codes")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {stats.activeCodes} {t("stats.activeCodes").toLowerCase()}
          </p>
        </Link>
      </div>
    </div>
  );
}
