"use client";

import { createFileRoute, redirect, notFound } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { LocaleLink } from "@/i18n/start-navigation";
import { useStepUp } from "@/components/start/auth/use-step-up";
import { changeParentPasswordFn, exportChildDataFn } from "@/lib/server/parent-reports";
import { listParentChildrenFn } from "@/lib/server/parent-children";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/$locale/parent/settings/")({
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
  component: ParentSettingsPage,
});

function ParentSettingsPage() {
  const { children } = Route.useLoaderData();
  const { withStepUp, stepUpDialog } = useStepUp();
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);

  const [selectedChildId, setSelectedChildId] = useState(children[0]?.id ?? "");
  const [exporting, setExporting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast.error(m.parent_settings_passwordTooShort());
      return;
    }
    if (newPassword !== confirm) {
      toast.error(m.parent_settings_passwordMismatch());
      return;
    }
    setSaving(true);
    try {
      const res = await withStepUp(() => changeParentPasswordFn({ data: { newPassword } }));
      if (res.ok) {
        toast.success(m.parent_settings_passwordChanged());
        setNewPassword("");
        setConfirm("");
      } else {
        toast.error(res.message ?? m.parent_settings_passwordError());
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleExport() {
    if (!selectedChildId) return;
    setExporting(true);
    try {
      const res = await withStepUp(() =>
        exportChildDataFn({ data: { childId: selectedChildId } }),
      );
      if (!res.ok) {
        toast.error(res.message ?? m.parent_settings_exportError());
        return;
      }
      const blob = new Blob([res.data], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = res.filename;
      anchor.click();
      URL.revokeObjectURL(url);
      toast.success(m.parent_settings_exportSuccess());
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="container mx-auto max-w-xl px-4 py-6">
      <LocaleLink
        href="/parent"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
        </svg>
        {m.parent_settings_backToDashboard()}
      </LocaleLink>

      <h1 className="text-2xl font-bold tracking-tight">{m.parent_settings_title()}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{m.parent_settings_subtitle()}</p>

      <section className="mt-6 rounded-lg border bg-card p-5">
        <h2 className="text-lg font-semibold">{m.parent_settings_changePasswordTitle()}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{m.parent_settings_changePasswordHint()}</p>

        <form method="post" onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label htmlFor="new-password" className="block text-sm font-medium">
              {m.parent_settings_newPasswordLabel()}
            </label>
            <input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
              className="mt-1 block w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              disabled={saving}
            />
          </div>
          <div>
            <label htmlFor="confirm-password" className="block text-sm font-medium">
              {m.parent_settings_confirmPasswordLabel()}
            </label>
            <input
              id="confirm-password"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              className="mt-1 block w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              disabled={saving}
            />
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving || !newPassword || !confirm}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {saving ? m.parent_settings_saving() : m.parent_settings_save()}
            </button>
          </div>
        </form>
      </section>

      <section className="mt-6 rounded-lg border bg-card p-5">
        <h2 className="text-lg font-semibold">{m.parent_settings_exportTitle()}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{m.parent_settings_exportHint()}</p>

        {children.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">{m.parent_settings_exportNoChildren()}</p>
        ) : (
          <div className="mt-4 space-y-4">
            {children.length > 1 && (
              <div>
                <label htmlFor="export-child" className="block text-sm font-medium">
                  {m.parent_settings_exportChildLabel()}
                </label>
                <select
                  id="export-child"
                  value={selectedChildId}
                  onChange={(e) => setSelectedChildId(e.target.value)}
                  disabled={exporting}
                  className="mt-1 block w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {children.map((child) => (
                    <option key={child.id} value={child.id}>
                      {child.name ?? m.parent_settings_exportUnnamedChild()}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleExport}
                disabled={exporting || !selectedChildId}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {exporting ? m.parent_settings_exporting() : m.parent_settings_exportButton()}
              </button>
            </div>
          </div>
        )}
      </section>

      {stepUpDialog}
    </div>
  );
}
