"use client";

import { useState } from "react";
import { m } from "@/paraglide/messages";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { createAccessCodeFn } from "@/lib/server/admin";
import { useLocaleRouter } from "@/i18n/start-navigation";

export function CreateCodeButton() {
  const router = useLocaleRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError("");

    try {
      const code = (formData.get("code") as string)?.trim() || undefined;
      const rawExpiresAt = (formData.get("expiresAt") as string) || undefined;
      const expiresAt = rawExpiresAt ? new Date(rawExpiresAt).toISOString() : undefined;

      const res = await createAccessCodeFn({ data: { code, expiresAt } });

      if (!res.ok) {
        setError(res.error === "code_exists" ? "Code already exists" : m.admin_codes_createError());
        return;
      }

      setOpen(false);
      router.refresh();
    } catch {
      setError(m.admin_codes_createError());
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <Plus className="size-4" />
          {m.admin_codes_createButton()}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{m.admin_codes_createTitle()}</DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="grid gap-4 py-4">
          <div className="grid gap-2">
            <label htmlFor="code" className="text-sm font-medium text-foreground">
              {m.admin_codes_codeLabel()}
            </label>
            <input
              id="code"
              name="code"
              placeholder={m.admin_codes_codePlaceholder()}
              className="rounded-lg border border-border px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
            />
          </div>
          <div className="grid gap-2">
            <label htmlFor="expiresAt" className="text-sm font-medium text-foreground">
              {m.admin_codes_expiresLabel()}
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
              {m.admin_codes_cancel()}
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "..." : m.admin_codes_create()}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
