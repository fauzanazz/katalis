"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { acknowledgeAlertFn } from "@/lib/server/admin-reliability";
import { useLocaleRouter } from "@/i18n/start-navigation";

export function AcknowledgeAlertButton({ alertId }: { alertId: string }) {
  const router = useLocaleRouter();
  const [isPending, startTransition] = useTransition();
  const [acked, setAcked] = useState(false);

  function handleAck() {
    startTransition(async () => {
      try {
        const res = await acknowledgeAlertFn({ data: { alertId } });
        if (!res.ok) {
          toast.error("Failed to acknowledge alert");
          return;
        }
        setAcked(true);
        toast.success("Alert acknowledged");
        router.refresh();
      } catch (error) {
        console.error("Acknowledge alert request failed:", error);
        toast.error("Failed to acknowledge alert");
      }
    });
  }

  if (acked) {
    return <span className="text-xs text-muted-foreground">Acknowledged</span>;
  }

  return (
    <button
      type="button"
      onClick={handleAck}
      disabled={isPending}
      className="rounded-md border border-border bg-background px-2 py-1 text-xs font-medium hover:bg-zinc-50 disabled:opacity-50"
    >
      {isPending ? "Acknowledging…" : "Acknowledge"}
    </button>
  );
}
