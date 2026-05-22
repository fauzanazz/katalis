"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";

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
  const t = useTranslations("parent.createChild");
  const [name, setName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accessCode, setAccessCode] = useState<string | null>(null);
  const [childId, setChildId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

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

      setChildId(data.child.id);
      setAccessCode(data.accessCode);
      onSuccess(data.child.id);
    } catch {
      setError(t("errorDefault"));
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!accessCode) return;
    await navigator.clipboard.writeText(accessCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDone = () => {
    setName("");
    setDateOfBirth("");
    setAccessCode(null);
    setChildId(null);
    setCopied(false);
    setError(null);
    onClose();
  };

  if (!open) return null;

  // Success step — show access code
  if (accessCode && childId) {
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
              <h2 className="text-lg font-semibold">{t("successTitle")}</h2>
              <p className="text-sm text-muted-foreground">{t("successDescription", { name: name })}</p>
            </div>
          </div>

          <div className="rounded-lg border bg-muted/50 p-4">
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {t("accessCodeLabel")}
            </p>
            <div className="group relative">
              <button
                type="button"
                onClick={handleCopy}
                className="flex w-full items-center justify-between rounded-md border bg-background px-4 py-3 text-left transition-colors hover:bg-muted"
                title={copied ? t("copied") : t("copyTooltip")}
              >
                <span className="font-mono text-2xl font-bold tracking-widest text-foreground">
                  {accessCode}
                </span>
                <span className="ml-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                  {copied ? (
                    <>
                      <svg className="h-4 w-4 text-green-500" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                      </svg>
                      <span className="text-green-500">{t("copied")}</span>
                    </>
                  ) : (
                    <>
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184" />
                      </svg>
                      {t("copyTooltip")}
                    </>
                  )}
                </span>
              </button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">{t("accessCodeHint")}</p>
          </div>

          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={handleDone}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              {t("done")}
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
