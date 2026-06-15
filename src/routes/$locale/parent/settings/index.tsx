"use client";

import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { LocaleLink } from "@/i18n/start-navigation";
import { useStepUp } from "@/components/start/auth/use-step-up";
import { changeParentPasswordFn } from "@/lib/server/parent";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/$locale/parent/settings/")({
  component: ParentSettingsPage,
});

function ParentSettingsPage() {
  const { withStepUp, stepUpDialog } = useStepUp();
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);

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

      {stepUpDialog}
    </div>
  );
}
