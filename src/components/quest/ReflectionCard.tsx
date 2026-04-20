"use client";

import { useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import {
  ChevronDown,
  ChevronUp,
  BookOpen,
  Star,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface AiSummary {
  summary: string;
  strengths: string[];
  encouragement: string;
}

interface ReflectionCardProps {
  questId: string;
  missionDay: number;
  readOnly?: boolean;
}

export function ReflectionCard({
  questId,
  missionDay,
  readOnly = false,
}: ReflectionCardProps) {
  const t = useTranslations("mentor.reflection");

  const [expanded, setExpanded] = useState(false);
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiSummary, setAiSummary] = useState<AiSummary | null>(null);
  const [alreadyExists, setAlreadyExists] = useState(false);

  const handleSubmit = useCallback(async () => {
    if (!content.trim()) return;

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/reflection/daily", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questId,
          missionDay,
          type: "text",
          content: content.trim(),
        }),
      });

      if (res.status === 409) {
        setAlreadyExists(true);
        return;
      }

      if (!res.ok) {
        throw new Error("Failed to submit reflection");
      }

      const data = await res.json();
      setAiSummary(data.aiSummary);
    } catch {
      setError("Failed to submit reflection");
    } finally {
      setSubmitting(false);
    }
  }, [questId, missionDay, content]);

  if (alreadyExists) {
    return (
      <div
        role="status"
        className="rounded-xl border bg-card p-4 shadow-sm"
      >
        <div className="flex items-center gap-2 text-muted-foreground">
          <CheckCircle2 className="size-5 text-green-600" aria-hidden="true" />
          <p className="text-sm">{t("alreadyExists")}</p>
        </div>
      </div>
    );
  }

  if (aiSummary) {
    return (
      <div className="rounded-xl border border-green-200 bg-card p-5 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <CheckCircle2 className="size-5 text-green-600" aria-hidden="true" />
          <h3 className="text-sm font-semibold text-green-700">
            {t("success")}
          </h3>
        </div>

        <p className="mb-4 text-sm leading-relaxed text-foreground">
          {aiSummary.summary}
        </p>

        {aiSummary.strengths.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-2">
            {aiSummary.strengths.map((strength) => (
              <span
                key={strength}
                className="inline-flex items-center gap-1 rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-700"
              >
                <Star className="size-3" aria-hidden="true" />
                {strength}
              </span>
            ))}
          </div>
        )}

        <p className="text-sm italic text-muted-foreground">
          {aiSummary.encouragement}
        </p>
      </div>
    );
  }

  if (readOnly) {
    return (
      <div className="rounded-xl border bg-card p-4 shadow-sm">
        <div className="flex items-center gap-2">
          <BookOpen className="size-5 text-muted-foreground" aria-hidden="true" />
          <h3 className="text-sm font-semibold text-foreground">{t("title")}</h3>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">{t("encouragement")}</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card shadow-sm">
      {/* Header — always visible, toggles expansion */}
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="flex w-full items-center justify-between p-4 text-left"
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-2">
          <BookOpen className="size-5 text-muted-foreground" aria-hidden="true" />
          <div>
            <h3 className="text-sm font-semibold text-foreground">{t("title")}</h3>
            <p className="text-xs text-muted-foreground">{t("subtitle")}</p>
          </div>
        </div>
        {expanded ? (
          <ChevronUp className="size-5 text-muted-foreground" aria-hidden="true" />
        ) : (
          <ChevronDown className="size-5 text-muted-foreground" aria-hidden="true" />
        )}
      </button>

      {/* Expandable body */}
      {expanded && (
        <div className="border-t px-4 pb-4 pt-3">
          <p className="mb-3 text-sm text-muted-foreground">
            {t("encouragement")}
          </p>

          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={t("textPlaceholder")}
            rows={4}
            className="w-full resize-none rounded-lg border border-border bg-background p-3 text-sm leading-relaxed text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />

          {error && (
            <p role="alert" className="mt-2 text-sm text-red-600">
              {error}
            </p>
          )}

          <Button
            onClick={handleSubmit}
            disabled={submitting || !content.trim()}
            className="mt-3 w-full sm:w-auto"
          >
            {submitting ? (
              <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />
            ) : null}
            {t("submitButton")}
          </Button>
        </div>
      )}
    </div>
  );
}
