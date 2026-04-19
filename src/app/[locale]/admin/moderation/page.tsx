import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db";
import { Shield, AlertTriangle, CheckCircle, XCircle, Eye } from "lucide-react";
import { ReviewActions } from "./ReviewActions";

export default async function AdminModerationPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const t = await getTranslations("admin.moderation");
  const params = await searchParams;
  const statusFilter = params.status;

  const where = statusFilter ? { status: statusFilter } : {};

  const [events, pending, flagged, blocked, approved] = await Promise.all([
    prisma.moderationEvent.findMany({
      where,
      take: 50,
      orderBy: { createdAt: "desc" },
    }),
    prisma.moderationEvent.count({ where: { status: "pending" } }),
    prisma.moderationEvent.count({ where: { status: "flagged" } }),
    prisma.moderationEvent.count({ where: { status: "blocked" } }),
    prisma.moderationEvent.count({ where: { status: "approved" } }),
  ]);

  const statCards = [
    { key: "flagged", value: flagged, icon: AlertTriangle, color: "text-orange-600" },
    { key: "pending", value: pending, icon: Eye, color: "text-yellow-600" },
    { key: "blocked", value: blocked, icon: XCircle, color: "text-red-600" },
    { key: "approved", value: approved, icon: CheckCircle, color: "text-green-600" },
  ] as const;

  const statusStyles: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-800",
    flagged: "bg-orange-100 text-orange-800",
    blocked: "bg-red-100 text-red-800",
    approved: "bg-green-100 text-green-800",
    redirected: "bg-blue-100 text-blue-800",
  };

  const severityStyles: Record<string, string> = {
    low: "bg-blue-50 text-blue-700",
    medium: "bg-yellow-50 text-yellow-700",
    high: "bg-orange-50 text-orange-700",
    critical: "bg-red-50 text-red-700",
  };

  const isActive = (filter: string) =>
    (statusFilter ?? "all") === filter || (filter === "all" && !statusFilter);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      {/* Stats */}
      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {statCards.map(({ key, value, icon: Icon, color }) => (
          <div key={key} className="rounded-xl border border-border/60 bg-background p-4">
            <div className="flex items-center gap-2">
              <Icon className={`size-4 ${color}`} />
            </div>
            <p className="mt-2 text-2xl font-bold text-foreground">{value}</p>
            <p className="text-xs text-muted-foreground">{t(`stat_${key}`)}</p>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="mb-6 flex gap-2 overflow-x-auto">
        {["all", "flagged", "pending", "blocked", "approved"].map((filter) => (
          <a
            key={filter}
            href={`/admin/moderation${filter === "all" ? "" : `?status=${filter}`}`}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              isActive(filter)
                ? "bg-foreground text-background"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {t(`filter_${filter}`)}
          </a>
        ))}
      </div>

      {/* Events table */}
      {events.length === 0 ? (
        <div className="rounded-xl border border-border/60 bg-background p-8 text-center">
          <Shield className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">{t("empty")}</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border/60">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60 bg-muted/50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t("col_date")}</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t("col_source")}</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t("col_type")}</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t("col_status")}</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t("col_category")}</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t("col_severity")}</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t("col_reasoning")}</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t("col_actions")}</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr key={event.id} className="border-b border-border/40 last:border-0">
                  <td className="px-4 py-3 text-muted-foreground">
                    {event.createdAt.toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">{event.sourceType}</td>
                  <td className="px-4 py-3">{event.contentType}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusStyles[event.status] ?? "bg-gray-100 text-gray-800"}`}>
                      {t(`status_${event.status}`)}
                    </span>
                  </td>
                  <td className="px-4 py-3">{event.category ?? "—"}</td>
                  <td className="px-4 py-3">
                    {event.severity ? (
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${severityStyles[event.severity] ?? "bg-gray-50 text-gray-700"}`}>
                        {event.severity}
                      </span>
                    ) : "—"}
                  </td>
                  <td className="max-w-xs truncate px-4 py-3 text-muted-foreground">
                    {event.aiReasoning ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    {(event.status === "flagged" || event.status === "pending") ? (
                      <ReviewActions eventId={event.id} onReviewed={() => {}} />
                    ) : event.reviewedAt ? (
                      <span className="text-xs text-muted-foreground">✓ {t("reviewed")}</span>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
