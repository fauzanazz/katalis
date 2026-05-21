"use client";

import { useCallback, useEffect, useState } from "react";
import { InterestInsights, type InterestInsightsData } from "./InterestInsights";

type Props = { childId: string };
type Status = "loading" | "ok" | "error";

function fetchInsights(
  childId: string,
  onSuccess: (data: InterestInsightsData) => void,
  onError: () => void,
): () => void {
  let cancelled = false;
  fetch(`/api/parent/children/${childId}/interests`)
    .then((res) => {
      if (!res.ok) throw new Error(`interests fetch failed: ${res.status}`);
      return res.json() as Promise<InterestInsightsData>;
    })
    .then((data) => {
      if (!cancelled) onSuccess(data);
    })
    .catch((err: unknown) => {
      if (!cancelled) {
        console.error("InterestInsightsClient:", err instanceof Error ? err.message : err);
        onError();
      }
    });
  return () => { cancelled = true; };
}

export function InterestInsightsClient({ childId }: Props) {
  const [status, setStatus] = useState<Status>("loading");
  const [insights, setInsights] = useState<InterestInsightsData | null>(null);

  const onSuccess = useCallback((data: InterestInsightsData) => {
    setInsights(data);
    setStatus("ok");
  }, []);

  const onError = useCallback(() => setStatus("error"), []);

  useEffect(() => {
    return fetchInsights(childId, onSuccess, onError);
  }, [childId, onSuccess, onError]);

  const retry = useCallback(() => {
    setStatus("loading");
    fetchInsights(childId, onSuccess, onError);
  }, [childId, onSuccess, onError]);

  if (status === "loading") {
    return (
      <p className="text-sm text-muted-foreground">Loading interest insights...</p>
    );
  }

  if (status === "error" || !insights) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">
          Interest insights unavailable right now.
        </p>
        <button
          onClick={retry}
          className="text-sm text-primary underline-offset-2 hover:underline"
        >
          Retry
        </button>
      </div>
    );
  }

  return <InterestInsights insights={insights} />;
}
