"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function CreateCodeButton() {
  const t = useTranslations("admin.codes");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError("");

    try {
      const code = (formData.get("code") as string)?.trim() || undefined;
      const expiresAt = (formData.get("expiresAt") as string) || undefined;

      const res = await fetch("/api/admin/codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, expiresAt }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error === "code_exists" ? "Code already exists" : t("createError"));
        return;
      }

      setOpen(false);
      window.location.reload();
    } catch {
      setError(t("createError"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <Plus className="size-4" />
          {t("createButton")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("createTitle")}</DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="grid gap-4 py-4">
          <div className="grid gap-2">
            <label htmlFor="code" className="text-sm font-medium text-foreground">
              {t("codeLabel")}
            </label>
            <input
              id="code"
              name="code"
              placeholder={t("codePlaceholder")}
              className="rounded-lg border border-border px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
            />
          </div>
          <div className="grid gap-2">
            <label htmlFor="expiresAt" className="text-sm font-medium text-foreground">
              {t("expiresLabel")}
            </label>
            <input
              id="expiresAt"
              name="expiresAt"
              type="datetime-local"
              className="rounded-lg border border-border px-3 py-2 text-sm text-foreground"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "..." : t("create")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
