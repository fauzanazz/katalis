"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { m } from "@/paraglide/messages";
import { createChildFn } from "@/lib/server/parent";

interface AddChildDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (childId: string) => void;
}

const MIN_AGE_YEARS = 3;
const MAX_AGE_YEARS = 12;

function isoForAgeYearsAgo(years: number): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - years);
  return d.toISOString().slice(0, 10);
}

function earliestAllowedDobIso(maxAgeYears: number): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - (maxAgeYears + 1));
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

export function AddChildDialog({ open, onClose, onSuccess }: AddChildDialogProps) {
  const [name, setName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState(false);

  const dobBounds = useMemo(
    () => ({
      min: earliestAllowedDobIso(MAX_AGE_YEARS),
      max: isoForAgeYearsAgo(MIN_AGE_YEARS),
    }),
    [],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !dateOfBirth) return;

    setLoading(true);

    try {
      const dobIso = new Date(`${dateOfBirth}T00:00:00.000Z`).toISOString();
      const result = await createChildFn({ data: { name: name.trim(), dateOfBirth: dobIso } });

      if (!result.ok) {
        toast.error(result.message ?? m.parent_createChild_errorDefault());
        return;
      }

      setCreated(true);
      onSuccess(result.child.id);
    } catch {
      toast.error(m.parent_createChild_errorDefault());
    } finally {
      setLoading(false);
    }
  };

  const handleDone = () => {
    setName("");
    setDateOfBirth("");
    setCreated(false);
    onClose();
  };

  if (!open) return null;

  // Success step — child created, ready to open from the dashboard.
  if (created) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="mx-4 w-full max-w-md rounded-lg border bg-background p-6 shadow-lg">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 text-green-600">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold">{m.parent_createChild_successTitle()}</h2>
              <p className="text-sm text-muted-foreground">{m.parent_createChild_successDescription({ name })}</p>
            </div>
          </div>

          <p className="text-sm text-muted-foreground">{m.parent_createChild_successHint()}</p>

          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={handleDone}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              {m.parent_createChild_done()}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Form step
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="mx-4 w-full max-w-md rounded-lg border bg-background p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold">{m.parent_createChild_title()}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{m.parent_createChild_description()}</p>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label htmlFor="child-name" className="block text-sm font-medium">
              {m.parent_createChild_nameLabel()}
            </label>
            <input
              id="child-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={m.parent_createChild_namePlaceholder()}
              className="mt-1 block w-full rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              disabled={loading}
              autoFocus
            />
          </div>

          <div>
            <label htmlFor="child-dob" className="block text-sm font-medium">
              {m.parent_createChild_dobLabel()}
            </label>
            <input
              id="child-dob"
              type="date"
              value={dateOfBirth}
              onChange={(e) => setDateOfBirth(e.target.value)}
              min={dobBounds.min}
              max={dobBounds.max}
              className="mt-1 block w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              disabled={loading}
              required
            />
            <p className="mt-1 text-xs text-muted-foreground">{m.parent_createChild_dobHelp()}</p>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted"
              disabled={loading}
            >
              {m.parent_createChild_cancel()}
            </button>
            <button
              type="submit"
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              disabled={loading || !name.trim() || !dateOfBirth}
            >
              {loading ? m.parent_createChild_creating() : m.parent_createChild_submit()}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
