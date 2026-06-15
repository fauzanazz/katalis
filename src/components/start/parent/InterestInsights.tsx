import type { InterestKey } from "@/lib/interests/taxonomy";

import { InterestRadarChart } from "./InterestRadarChart";

export type EvidenceSource = {
  source: string;
  observedAt: string;
  dimension: string;
  strength: number;
};

export type TopInterest = {
  interestKey: InterestKey;
  score: number;
  confidence: number;
  trend: "rising" | "falling" | "stable";
  stability?: "fleeting" | "emerging" | "sustained";
  signalCount: number;
  distinctDays?: number;
  firstSignalAt?: string | null;
  lastSignalAt: string | null;
  summary: string | null;
  recentEvidence?: EvidenceSource[];
};

export type RecentSignal = {
  interestKey: InterestKey;
  source: string;
  dimension: string;
  strength: number;
  observedAt: string;
};

export type InterestInsightsData = {
  topInterests: TopInterest[];
  recentSignals: RecentSignal[];
  suggestedNextQuestions: string[];
};

type Props = {
  insights: InterestInsightsData;
};

function formatKey(key: string): string {
  return key
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return iso.slice(0, 10);
}

export function InterestInsights({ insights }: Props) {
  const { topInterests, recentSignals, suggestedNextQuestions } = insights;
  const isEmpty = topInterests.length === 0 && recentSignals.length === 0;

  return (
    <section>
      <h3 className="text-base font-semibold text-foreground">
        Interest patterns over time
      </h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Signals from discoveries, quests, missions, reflections, and ratings.
      </p>

      {isEmpty ? (
        <p className="mt-4 rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
          No interest signals yet. Complete discoveries, quests, and mission
          ratings to build trends.
        </p>
      ) : (
        <div className="mt-4 space-y-6">
          {topInterests.length >= 3 && (
            <div className="rounded-lg border bg-card p-4">
              <p className="mb-2 text-sm font-medium">
                Currently exploring (top {Math.min(topInterests.length, 5)})
              </p>
              <InterestRadarChart interests={topInterests.slice(0, 5)} />
            </div>
          )}
          {topInterests.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2">
              {topInterests.map((interest) => (
                <div
                  key={interest.interestKey}
                  className="rounded-lg border bg-card p-3 text-sm"
                >
                  <p className="font-medium">{formatKey(interest.interestKey)}</p>
                  <p className="text-muted-foreground">
                    Trend: {interest.trend}
                    {interest.stability && (
                      <>
                        {" "}
                        · {interest.stability === "sustained"
                          ? "sustained interest"
                          : interest.stability === "emerging"
                            ? "emerging interest"
                            : "currently enjoying"}
                      </>
                    )}
                  </p>
                  <p className="text-muted-foreground">
                    Confidence: {Math.round(interest.confidence * 100)}%
                  </p>
                  <p className="text-muted-foreground">
                    Signals: {interest.signalCount}
                    {typeof interest.distinctDays === "number" &&
                      ` across ${interest.distinctDays} day${
                        interest.distinctDays === 1 ? "" : "s"
                      }`}
                  </p>
                  <p className="text-muted-foreground">
                    Last observed: {formatDate(interest.lastSignalAt)}
                  </p>
                  {interest.summary && (
                    <p className="mt-1 italic text-muted-foreground">
                      {interest.summary}
                    </p>
                  )}
                  {interest.recentEvidence &&
                    interest.recentEvidence.length > 0 && (
                      <details className="mt-2 text-xs text-muted-foreground">
                        <summary className="cursor-pointer">
                          Why we say this
                        </summary>
                        <ul className="mt-1 space-y-1">
                          {interest.recentEvidence.map((e, i) => (
                            <li key={i}>
                              {formatDate(e.observedAt)} — {formatKey(e.source)}{" "}
                              ({formatKey(e.dimension)})
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                </div>
              ))}
            </div>
          )}

          {recentSignals.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                    <th className="pb-2 pr-4" scope="col">Date</th>
                    <th className="pb-2 pr-4" scope="col">Interest</th>
                    <th className="pb-2 pr-4" scope="col">Source</th>
                    <th className="pb-2 pr-4" scope="col">Signal</th>
                    <th className="pb-2" scope="col">Strength</th>
                  </tr>
                </thead>
                <tbody>
                  {recentSignals.map((sig, i) => (
                    <tr
                      key={`${sig.observedAt}-${i}`}
                      className="border-b last:border-0"
                    >
                      <td className="py-1.5 pr-4 text-muted-foreground">
                        {formatDate(sig.observedAt)}
                      </td>
                      <td className="py-1.5 pr-4">
                        {formatKey(sig.interestKey)}
                      </td>
                      <td className="py-1.5 pr-4 text-muted-foreground">
                        {formatKey(sig.source)}
                      </td>
                      <td className="py-1.5 pr-4">
                        {formatKey(sig.dimension)}
                      </td>
                      <td className="py-1.5 tabular-nums">
                        {sig.strength.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {suggestedNextQuestions.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-medium">Suggested questions</p>
              <ul className="space-y-1">
                {suggestedNextQuestions.map((q, i) => (
                  <li
                    key={i}
                    className="rounded bg-muted/50 px-3 py-1.5 text-sm text-muted-foreground"
                  >
                    {q}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
