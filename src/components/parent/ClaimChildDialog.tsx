"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

interface ClaimChildDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (childId: string) => void;
}

export function ClaimChildDialog({ open, onClose, onSuccess }: ClaimChildDialogProps) {
  const t = useTranslations("parent.claim");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/parent/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessCode: code.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || t("errorDefault"));
        return;
      }

      setCode("");
      onSuccess(data.childId);
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
            <label htmlFor="access-code" className="block text-sm font-medium">
              {t("codeLabel")}
            </label>
            <input
              id="access-code"
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder={t("codePlaceholder")}
              className="mt-1 block w-full rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              disabled={loading}
            />
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
              disabled={loading || !code.trim()}
            >
              {loading ? t("linking") : t("submit")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
