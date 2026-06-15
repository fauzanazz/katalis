"use client";

export interface Suggestion {
  activity: string;
  reason: string;
  materials?: string[];
}

interface ActionableSuggestionsProps {
  suggestions: Suggestion[];
}

export function ActionableSuggestions({ suggestions }: ActionableSuggestionsProps) {
  if (suggestions.length === 0) return null;

  return (
    <div className="rounded-xl border bg-card p-5">
      <h3 className="mb-1 text-sm font-semibold uppercase tracking-wider text-primary">
        Try This at Home
      </h3>
      <p className="mb-4 text-xs text-muted-foreground">
        Simple activities you can do together
      </p>

      <div className="space-y-3">
        {suggestions.map((s, i) => (
          <div
            key={i}
            className="rounded-lg border border-green-leaf/40 bg-green-leaf-light/20 p-4"
          >
            <p className="text-sm font-semibold text-foreground">{s.activity}</p>
            <p className="mt-1 text-xs text-muted-foreground">{s.reason}</p>

            {s.materials && s.materials.length > 0 && (
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  You&apos;ll need:
                </span>
                {s.materials.map((mat) => (
                  <span
                    key={mat}
                    className="rounded-full bg-card px-2 py-0.5 text-[11px] text-muted-foreground"
                  >
                    {mat}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
