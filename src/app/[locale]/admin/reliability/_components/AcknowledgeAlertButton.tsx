"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export function AcknowledgeAlertButton({ alertId }: { alertId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [acked, setAcked] = useState(false);

  function handleAck() {
    startTransition(async () => {
      const response = await fetch(
        `/api/admin/reliability/alerts/${alertId}/ack`,
        { method: "POST" },
      );
      if (!response.ok) {
        toast.error("Failed to acknowledge alert");
        return;
      }
      setAcked(true);
      toast.success("Alert acknowledged");
      router.refresh();
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
