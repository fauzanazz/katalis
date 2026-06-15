"use client";

import { useState } from "react";
import { m } from "@/paraglide/messages";
import { Button } from "@/components/ui/button";
import { reviewModerationEventFn } from "@/lib/server/admin-moderation";
import { useLocaleRouter } from "@/i18n/start-navigation";

interface ReviewActionsProps {
  eventId: string;
}

export function ReviewActions({ eventId }: ReviewActionsProps) {
  const router = useLocaleRouter();
  const [loading, setLoading] = useState(false);

  async function handleReview(action: "approve" | "block") {
    setLoading(true);
    try {
      const res = await reviewModerationEventFn({ data: { eventId, action } });
      if (res.ok) {
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex gap-2">
      <Button
        size="sm"
        variant="outline"
        onClick={() => handleReview("approve")}
        disabled={loading}
      >
        {m.admin_moderation_approve()}
      </Button>
      <Button
        size="sm"
        variant="destructive"
        onClick={() => handleReview("block")}
        disabled={loading}
      >
        {m.admin_moderation_block()}
      </Button>
    </div>
  );
}
