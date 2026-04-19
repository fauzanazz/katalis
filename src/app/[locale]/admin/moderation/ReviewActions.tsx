"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

interface ReviewActionsProps {
  eventId: string;
  onReviewed: () => void;
}

export function ReviewActions({ eventId, onReviewed }: ReviewActionsProps) {
  const t = useTranslations("admin.moderation");
  const [loading, setLoading] = useState(false);

  async function handleReview(action: "approve" | "block") {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/moderation/${eventId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      if (res.ok) {
        onReviewed();
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
        {t("approve")}
      </Button>
      <Button
        size="sm"
        variant="destructive"
        onClick={() => handleReview("block")}
        disabled={loading}
      >
        {t("block")}
      </Button>
    </div>
  );
}
