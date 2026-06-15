"use client";

import { useState, useMemo } from "react";
import { createFileRoute, redirect, notFound } from "@tanstack/react-router";
import { m } from "@/paraglide/messages";
import { LocaleLink, useLocaleRouter } from "@/i18n/start-navigation";
import { AddChildDialog } from "@/components/start/parent/AddChildDialog";
import { BackfillDoBPrompt } from "@/components/start/parent/BackfillDoBPrompt";
import { ChildCard } from "@/components/start/parent/ChildCard";
import { CapabilityTrajectoryCard } from "@/components/start/parent/CapabilityTrajectoryCard";
import { listParentChildrenFn } from "@/lib/server/parent-children";
import type { ZpdBand } from "@/lib/zpd";

export const Route = createFileRoute("/$locale/parent/")({
  loader: async ({ params }) => {
    const res = await listParentChildrenFn();
    if (!res.ok) {
      if (res.error === "unauthorized") {
        throw redirect({ href: `/${params.locale}/login` });
      }
      throw notFound();
    }
    return { children: res.children };
  },
  component: ParentDashboardPage,
});

function ParentDashboardPage() {
  const { children } = Route.useLoaderData();
  const router = useLocaleRouter();
  const [showAddDialog, setShowAddDialog] = useState(false);

  const zpdLabels = useMemo(
    () => ({
      title: m.parent_dashboard_zpd_title(),
      placeholder: m.parent_dashboard_zpd_placeholder(),
      bands: {
        emerging: m.parent_dashboard_zpd_bands_emerging(),
        developing: m.parent_dashboard_zpd_bands_developing(),
        proficient: m.parent_dashboard_zpd_bands_proficient(),
        extending: m.parent_dashboard_zpd_bands_extending(),
      } satisfies Record<ZpdBand, string>,
    }),
    [],
  );

  const childrenMissingDob = useMemo(
    () =>
      children
        .filter((c) => !c.dateOfBirth)
        .map((c) => ({ id: c.id, name: c.name })),
    [children],
  );

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {m.parent_dashboard_title()}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {m.parent_dashboard_subtitle()}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowAddDialog(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 4.5v15m7.5-7.5h-15"
              />
            </svg>
            {m.parent_dashboard_addChild()}
          </button>
          <LocaleLink
            href="/parent/settings"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-transparent px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
          >
            {m.parent_dashboard_settings()}
          </LocaleLink>
        </div>
      </div>

      <BackfillDoBPrompt
        childrenMissingDob={childrenMissingDob}
        onUpdated={() => router.refresh()}
      />

      {children.length === 0 ? (
        <div className="rounded-lg border bg-muted/30 p-8 text-center">
          <p className="text-lg font-medium text-muted-foreground">
            {m.parent_dashboard_noChildren()}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {m.parent_dashboard_noChildrenHint()}
          </p>
          <div className="mt-4 flex justify-center gap-2">
            <button
              onClick={() => setShowAddDialog(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              {m.parent_dashboard_addChild()}
            </button>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {children.map((child) => (
            <div key={child.id} className="flex flex-col gap-3">
              <ChildCard child={child} />
              <CapabilityTrajectoryCard
                childId={child.id}
                snapshots={child.zpdSnapshots ?? []}
                labels={zpdLabels}
              />
            </div>
          ))}
        </div>
      )}

      <AddChildDialog
        open={showAddDialog}
        onClose={() => setShowAddDialog(false)}
        onSuccess={() => router.refresh()}
      />
    </div>
  );
}
