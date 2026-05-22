"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

interface Props {
  discoveryId: string;
  aiInterestKeys: string[];
  aiTagCategories: string[];
  allInterestKeys: string[];
  allTagCategories: string[];
}

export function RatingForm({
  discoveryId,
  aiInterestKeys,
  aiTagCategories,
  allInterestKeys,
  allTagCategories,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [humanInterestKeys, setHumanInterestKeys] = useState<Set<string>>(
    new Set(),
  );
  const [humanTagCategories, setHumanTagCategories] = useState<Set<string>>(
    new Set(),
  );
  const [notes, setNotes] = useState("");

  function toggle(set: Set<string>, value: string): Set<string> {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    return next;
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const response = await fetch("/api/admin/reliability/ratings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          discoveryId,
          humanInterestKeys: [...humanInterestKeys],
          humanTagCategories: [...humanTagCategories],
          notes: notes.trim() || undefined,
        }),
      });
      if (!response.ok) {
        const detail = await response.json().catch(() => ({}));
        toast.error(detail?.error ?? "Submission failed");
        return;
      }
      toast.success("Rating saved");
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <LabelGroup
        title="Interest keys"
        aiLabels={aiInterestKeys}
        all={allInterestKeys}
        selected={humanInterestKeys}
        onToggle={(v) => setHumanInterestKeys((s) => toggle(s, v))}
      />
      <LabelGroup
        title="Tag categories"
        aiLabels={aiTagCategories}
        all={allTagCategories}
        selected={humanTagCategories}
        onToggle={(v) => setHumanTagCategories((s) => toggle(s, v))}
      />

      <div>
        <label
          htmlFor="notes"
          className="block text-sm font-semibold text-muted-foreground"
        >
          Notes (optional)
        </label>
        <textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          placeholder="Anything noteworthy about the artifact or the AI's prediction"
        />
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50"
        >
          {isPending ? "Saving…" : "Submit and load next"}
        </button>
        <span className="text-xs text-muted-foreground">
          Tip: select every label that applies (multi-label).
        </span>
      </div>
    </form>
  );
}

function LabelGroup({
  title,
  aiLabels,
  all,
  selected,
  onToggle,
}: {
  title: string;
  aiLabels: string[];
  all: string[];
  selected: Set<string>;
  onToggle: (v: string) => void;
}) {
  const aiSet = new Set(aiLabels);

  return (
    <fieldset>
      <legend className="text-sm font-semibold text-muted-foreground">
        {title}
      </legend>
      <p className="mt-1 text-xs text-muted-foreground">
        AI predicted:{" "}
        {aiLabels.length === 0 ? (
          <span className="italic">none</span>
        ) : (
          aiLabels.map((l) => (
            <span
              key={l}
              className="mr-1 inline-block rounded bg-blue-50 px-1.5 py-0.5 font-mono text-[11px] text-blue-700"
            >
              {l}
            </span>
          ))
        )}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {all.map((label) => {
          const isAi = aiSet.has(label);
          const isSelected = selected.has(label);
          return (
            <button
              key={label}
              type="button"
              onClick={() => onToggle(label)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                isSelected
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-background text-foreground hover:bg-zinc-50"
              } ${isAi ? "ring-1 ring-blue-300" : ""}`}
              title={isAi ? "AI also predicted this" : undefined}
            >
              {label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
