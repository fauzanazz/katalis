"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";

interface AddChildDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (childId: string) => void;
}

const MIN_AGE_YEARS = 3;
const MAX_AGE_YEARS = 13;

function isoForAgeYearsAgo(years: number): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - years);
  return d.toISOString().slice(0, 10);
}

export function AddChildDialog({ open, onClose, onSuccess }: AddChildDialogProps) {
  const t = useTranslations("parent.createChild");
  const [name, setName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dobBounds = useMemo(
    () => ({
      min: isoForAgeYearsAgo(MAX_AGE_YEARS),
      max: isoForAgeYearsAgo(MIN_AGE_YEARS),
    }),
    [],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !dateOfBirth) return;

    setLoading(true);
    setError(null);

    try {
      const dobIso = new Date(`${dateOfBirth}T00:00:00.000Z`).toISOString();
      const response = await fetch("/api/parent/create-child", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), dateOfBirth: dobIso }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || t("errorDefault"));
        return;
      }

      setName("");
      setDateOfBirth("");
      onSuccess(data.child.id);
      onClose();
    } catch {
      setError(t("errorDefault"));
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="mx-4 w-full max-w-md rounded-lg border bg-background p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold">{t("title")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("description")}</p>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label htmlFor="child-name" className="block text-sm font-medium">
              {t("nameLabel")}
            </label>
            <input
              id="child-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("namePlaceholder")}
              className="mt-1 block w-full rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              disabled={loading}
              autoFocus
            />
          </div>

          <div>
            <label htmlFor="child-dob" className="block text-sm font-medium">
              {t("dobLabel")}
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
            <p className="mt-1 text-xs text-muted-foreground">{t("dobHelp")}</p>
          </div>

          {error && (
            <p className="text-sm text-red-600" role="alert">{error}</p>
          )}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted"
              disabled={loading}
            >
              {t("cancel")}
            </button>
            <button
              type="submit"
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              disabled={loading || !name.trim() || !dateOfBirth}
            >
              {loading ? t("creating") : t("submit")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
