"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

const MIN_AGE_YEARS = 3;
const MAX_AGE_YEARS = 12;

function isoForAgeYearsAgo(years: number): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - years);
  return d.toISOString().slice(0, 10);
}

function earliestAllowedDobIso(maxAgeYears: number): string {
  // One day after `maxAgeYears` ago, so a child who turns `maxAgeYears+1` today
  // is correctly rejected.
  const d = new Date();
  d.setFullYear(d.getFullYear() - (maxAgeYears + 1));
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

export interface BackfillDoBChild {
  id: string;
  name?: string;
}

interface BackfillDoBPromptProps {
  childrenMissingDob: BackfillDoBChild[];
  /** Called after successful update so parent can refetch. */
  onUpdated?: (childId: string) => void;
}

/**
 * Inline banner shown above the child cards on `/parent` when any of the
 * parent's linked children has `dateOfBirth === null`. One row per affected
 * child, each with its own date picker. Non-blocking; reappears next visit
 * until all DoBs are filled.
 */
export function BackfillDoBPrompt({ childrenMissingDob, onUpdated }: BackfillDoBPromptProps) {
  const t = useTranslations("parent.backfillDob");
  const dobBounds = useMemo(
    () => ({
      min: earliestAllowedDobIso(MAX_AGE_YEARS),
      max: isoForAgeYearsAgo(MIN_AGE_YEARS),
    }),
    [],
  );

  if (childrenMissingDob.length === 0) return null;

  return (
    <section
      aria-labelledby="backfill-dob-heading"
      className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm"
    >
      <h2 id="backfill-dob-heading" className="font-semibold text-amber-900">
        {t("title")}
      </h2>
      <p className="mt-1 text-amber-900/80">{t("description")}</p>
      <ul className="mt-3 space-y-2">
        {childrenMissingDob.map((child) => (
          <BackfillRow
            key={child.id}
            child={child}
            dobBounds={dobBounds}
            onUpdated={onUpdated}
          />
        ))}
      </ul>
    </section>
  );
}

function BackfillRow({
  child,
  dobBounds,
  onUpdated,
}: {
  child: BackfillDoBChild;
  dobBounds: { min: string; max: string };
  onUpdated?: (childId: string) => void;
}) {
  const t = useTranslations("parent.backfillDob");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dateOfBirth) return;
    setLoading(true);
    try {
      const dobIso = new Date(`${dateOfBirth}T00:00:00.000Z`).toISOString();
      const response = await fetch(`/api/parent/children/${child.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dateOfBirth: dobIso }),
      });
      const data = await response.json();
      if (!response.ok) {
        toast.error(data.message ?? t("errorDefault"));
        return;
      }
      toast.success(t("success", { name: child.name ?? t("unnamed") }));
      onUpdated?.(child.id);
    } catch {
      toast.error(t("errorDefault"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <li>
      <form
        onSubmit={handleSubmit}
        className="flex flex-wrap items-center gap-2"
      >
        <span className="font-medium text-amber-900">
          {child.name ?? t("unnamed")}
        </span>
        <input
          type="date"
          value={dateOfBirth}
          onChange={(e) => setDateOfBirth(e.target.value)}
          min={dobBounds.min}
          max={dobBounds.max}
          className="rounded-md border border-amber-300 bg-white px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          disabled={loading}
          required
          aria-label={t("dateInputLabel", { name: child.name ?? t("unnamed") })}
        />
        <button
          type="submit"
          className="rounded-md bg-amber-600 px-3 py-1 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
          disabled={loading || !dateOfBirth}
        >
          {loading ? t("saving") : t("submit")}
        </button>
      </form>
    </li>
  );
}
