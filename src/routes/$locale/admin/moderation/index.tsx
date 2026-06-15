import React from "react";
import { createFileRoute, redirect, notFound } from "@tanstack/react-router";
import { Shield, AlertTriangle, CheckCircle, XCircle, Eye } from "lucide-react";
import { m } from "@/paraglide/messages";
import { LocaleLink } from "@/i18n/start-navigation";
import { ReviewActions } from "@/components/start/admin/ReviewActions";
import { listModerationEventsFn } from "@/lib/server/admin-moderation";

const VALID_STATUSES = ["pending", "flagged", "blocked", "approved", "redirected"];

export const Route = createFileRoute("/$locale/admin/moderation/")({
  validateSearch: (s: Record<string, unknown>) => ({
    status:
      typeof s.status === "string" && VALID_STATUSES.includes(s.status)
        ? s.status
        : undefined,
  }),
  loaderDeps: ({ search }) => ({
    status: search.status,
  }),
  loader: async ({ params, deps }) => {
    const res = await listModerationEventsFn({
      data: { status: deps.status },
    });
    if (!res.ok) {
      if (res.error === "unauthorized")
        throw redirect({ href: `/${params.locale}/parent` });
      throw notFound();
    }
    return { events: res.events, counts: { pending: res.pending, flagged: res.flagged, blocked: res.blocked, approved: res.approved } };
  },
  component: AdminModerationPage,
});

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  flagged: "bg-orange-100 text-orange-800",
  blocked: "bg-red-100 text-red-800",
  approved: "bg-green-100 text-green-800",
  redirected: "bg-blue-100 text-blue-800",
};

const SEVERITY_STYLES: Record<string, string> = {
  low: "bg-blue-50 text-blue-700",
  medium: "bg-yellow-50 text-yellow-700",
  high: "bg-orange-50 text-orange-700",
  critical: "bg-red-50 text-red-700",
};

type StatKey = "flagged" | "pending" | "blocked" | "approved";
type StatusKey = "pending" | "flagged" | "blocked" | "approved" | "redirected";

const STAT_LABELS: Record<StatKey, () => string> = {
  flagged: m.admin_moderation_stat_flagged,
  pending: m.admin_moderation_stat_pending,
  blocked: m.admin_moderation_stat_blocked,
  approved: m.admin_moderation_stat_approved,
};

const STATUS_LABELS: Record<StatusKey, () => string> = {
  pending: m.admin_moderation_status_pending,
  flagged: m.admin_moderation_status_flagged,
  blocked: m.admin_moderation_status_blocked,
  approved: m.admin_moderation_status_approved,
  redirected: m.admin_moderation_status_redirected,
};

const FILTER_LABELS: Record<string, () => string> = {
  all: m.admin_moderation_filter_all,
  flagged: m.admin_moderation_filter_flagged,
  pending: m.admin_moderation_filter_pending,
  blocked: m.admin_moderation_filter_blocked,
  approved: m.admin_moderation_filter_approved,
};

const STAT_CARDS: Array<{ key: StatKey; icon: React.ElementType; color: string }> = [
  { key: "flagged", icon: AlertTriangle, color: "text-orange-600" },
  { key: "pending", icon: Eye, color: "text-yellow-600" },
  { key: "blocked", icon: XCircle, color: "text-red-600" },
  { key: "approved", icon: CheckCircle, color: "text-green-600" },
];

const FILTER_TABS = ["all", "flagged", "pending", "blocked", "approved"] as const;

function AdminModerationPage() {
  const { events, counts } = Route.useLoaderData();
  const { status: statusFilter } = Route.useSearch();

  const isActive = (filter: string) =>
    filter === "all" ? !statusFilter : statusFilter === filter;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">{m.admin_moderation_title()}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{m.admin_moderation_subtitle()}</p>
      </div>

      {/* Stats */}
      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {STAT_CARDS.map(({ key, icon: Icon, color }) => (
          <div key={key} className="rounded-xl border border-border/60 bg-background p-4">
            <div className="flex items-center gap-2">
              <Icon className={`size-4 ${color}`} />
            </div>
            <p className="mt-2 text-2xl font-bold text-foreground">{counts[key]}</p>
            <p className="text-xs text-muted-foreground">{STAT_LABELS[key]()}</p>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="mb-6 flex gap-2 overflow-x-auto">
        {FILTER_TABS.map((filter) => (
          <LocaleLink
            key={filter}
            href="/admin/moderation"
            search={filter === "all" ? {} : { status: filter }}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              isActive(filter)
                ? "bg-foreground text-background"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {FILTER_LABELS[filter]()}
          </LocaleLink>
        ))}
      </div>

      {/* Events table */}
      {events.length === 0 ? (
        <div className="rounded-xl border border-border/60 bg-background p-8 text-center">
          <Shield className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">{m.admin_moderation_empty()}</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border/60">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60 bg-muted/50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">{m.admin_moderation_col_date()}</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">{m.admin_moderation_col_source()}</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">{m.admin_moderation_col_type()}</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">{m.admin_moderation_col_status()}</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">{m.admin_moderation_col_category()}</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">{m.admin_moderation_col_severity()}</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">{m.admin_moderation_col_reasoning()}</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">{m.admin_moderation_col_actions()}</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr key={event.id} className="border-b border-border/40 last:border-0">
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(event.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">{event.sourceType}</td>
                  <td className="px-4 py-3">{event.contentType}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[event.status] ?? "bg-gray-100 text-gray-800"}`}>
                      {STATUS_LABELS[event.status as StatusKey]?.() ?? event.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">{event.category ?? "—"}</td>
                  <td className="px-4 py-3">
                    {event.severity ? (
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${SEVERITY_STYLES[event.severity] ?? "bg-gray-50 text-gray-700"}`}>
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
                      <span className="text-xs text-muted-foreground">✓ {m.admin_moderation_reviewed()}</span>
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
