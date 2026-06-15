"use client";

import { useState, type FormEvent } from "react";
import { m } from "@/paraglide/messages";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { stepUpFn } from "@/lib/server/auth";

interface StepUpDialogProps {
  open: boolean;
  /** Called with true once the password is verified, false on cancel. */
  onResolved: (verified: boolean) => void;
}

/**
 * Password re-authentication (step-up) prompt for dangerous parent actions.
 * TanStack Start variant: stamps the session via the `stepUpFn` server function
 * (returns a `Result`) instead of the Next `POST /api/auth/step-up` fetch.
 */
export function StepUpDialog({ open, onResolved }: StepUpDialogProps) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function reset() {
    setPassword("");
    setError(null);
    setSubmitting(false);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!password) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await stepUpFn({ data: { password } });
      if (res.ok) {
        reset();
        onResolved(true);
        return;
      }
      setError(m.stepUp_error());
    } catch {
      setError(m.stepUp_error());
    } finally {
      setSubmitting(false);
    }
  }

  function handleCancel() {
    reset();
    onResolved(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o && !submitting) handleCancel();
      }}
    >
      <DialogContent showCloseButton={!submitting}>
        <DialogHeader>
          <DialogTitle>{m.stepUp_title()}</DialogTitle>
          <DialogDescription>{m.stepUp_description()}</DialogDescription>
        </DialogHeader>
        <form method="post" onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="step-up-password" className="block text-sm font-medium">
              {m.stepUp_passwordLabel()}
            </label>
            <input
              id="step-up-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
              autoComplete="current-password"
              className="mt-1 block w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              disabled={submitting}
            />
          </div>
          {error && (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={handleCancel} disabled={submitting}>
              {m.stepUp_cancel()}
            </Button>
            <Button type="submit" disabled={submitting || !password}>
              {submitting ? m.stepUp_verifying() : m.stepUp_submit()}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
