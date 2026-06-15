"use client";

import { useState } from "react";
import { submitInterestRatingFn } from "@/lib/server/parent-interests";

type Status = "idle" | "saving" | "saved" | "error";

type Props = {
  childId: string;
  missionId: string;
  interestKey: string;
  initialRating?: number | null;
};

export function MissionInterestRating({
  childId,
  missionId,
  interestKey,
  initialRating = null,
}: Props) {
  const [selected, setSelected] = useState<number | null>(initialRating ?? null);
  const [status, setStatus] = useState<Status>("idle");

  const handleRate = async (rating: number) => {
    setSelected(rating);
    setStatus("saving");
    try {
      const res = await submitInterestRatingFn({
        data: { childId, missionId, interestKey, rating, rater: "parent" },
      });
      if (!res.ok) {
        setStatus("error");
      } else {
        setStatus("saved");
      }
    } catch {
      setStatus("error");
    }
  };

  const isSaving = status === "saving";

  return (
    <div>
      <div
        role="group"
        aria-label="Interest rating"
        className="flex gap-1"
      >
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            aria-label={`Rate interest ${n}`}
            aria-pressed={selected === n}
            disabled={isSaving}
            onClick={() => handleRate(n)}
            className={`flex size-8 items-center justify-center rounded border text-sm font-medium transition-colors
              ${selected === n
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background text-foreground hover:bg-muted"
              }
              disabled:opacity-50`}
          >
            {n}
          </button>
        ))}
      </div>
      {status === "saving" && (
        <p className="mt-1 text-xs text-muted-foreground">Saving...</p>
      )}
      {status === "saved" && (
        <p className="mt-1 text-xs text-green-600">Saved</p>
      )}
      {status === "error" && (
        <p className="mt-1 text-xs text-destructive">
          Could not save rating. Try again.
        </p>
      )}
    </div>
  );
}
