import { Link } from "@/i18n/navigation";
import { AlertTriangle, ClipboardCheck, ListChecks } from "lucide-react";
import { computeLiveKappa, KAPPA_ADEQUACY_THRESHOLD } from "@/lib/reliability/service";
import { listUnacknowledgedAlerts } from "@/lib/reliability/repository";
import type { Layer } from "@/lib/reliability/types";
import { LAYERS } from "@/lib/reliability/types";
import { AcknowledgeAlertButton } from "./_components/AcknowledgeAlertButton";

const LAYER_LABEL: Record<Layer, string> = {
  interest_keys: "Interest keys",
  tag_categories: "Tag categories",
};

function formatKappa(k: number | null) {
  if (k === null) return "—";
  return k.toFixed(3);
}

export default async function ReliabilityDashboardPage() {
  const [layer0, layer1, alerts] = await Promise.all([
    computeLiveKappa(LAYERS[0]),
    computeLiveKappa(LAYERS[1]),
    listUnacknowledgedAlerts(),
  ]);

  const layerResults = [layer0, layer1] as const;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Reliability</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            AI vs human inter-rater agreement (Cohen&apos;s Kappa, macro per
            label). Threshold: <strong>{KAPPA_ADEQUACY_THRESHOLD}</strong>.
          </p>
        </div>
        <Link
          href="/admin/reliability/rate"
          className="inline-flex items-center gap-2 rounded-md bg-foreground px-3 py-2 text-sm font-medium text-background hover:opacity-90"
        >
          <ClipboardCheck className="size-4" />
          Rate next discovery
        </Link>
      </header>

      {alerts.length > 0 ? (
        <section className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4">
          <div className="mb-3 flex items-center gap-2 text-red-700">
            <AlertTriangle className="size-4" />
            <h2 className="font-semibold">
              {alerts.length} unacknowledged alert{alerts.length === 1 ? "" : "s"}
            </h2>
          </div>
          <ul className="space-y-2 text-sm">
            {alerts.map((alert) => (
              <li
                key={alert.id}
                className="flex items-center justify-between rounded-md bg-background px-3 py-2"
              >
                <span>
                  <strong>{LAYER_LABEL[alert.layer as Layer]}</strong> — Kappa{" "}
                  <span className="font-mono">{alert.kappa.toFixed(3)}</span> on{" "}
                  {alert.sampleSize} ratings (
                  {new Date(alert.createdAt).toLocaleString()})
                </span>
                <AcknowledgeAlertButton alertId={alert.id} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2">
        {layerResults.map((result) => (
          <article
            key={result.layer}
            className="rounded-xl border border-border/60 bg-background p-5"
          >
            <h3 className="text-sm font-semibold uppercase text-muted-foreground">
              {LAYER_LABEL[result.layer]}
            </h3>
            <p className="mt-2 font-mono text-3xl font-bold text-foreground">
              {formatKappa(result.kappa)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Sample size: {result.sampleSize}
              {result.needed > 0 ? (
                <span className="ml-2 inline-flex items-center gap-1 rounded bg-amber-50 px-2 py-0.5 text-amber-700">
                  Need {result.needed} more
                </span>
              ) : null}
            </p>

            {result.perLabel.length > 0 ? (
              <details className="mt-4 text-sm">
                <summary className="cursor-pointer text-muted-foreground">
                  <ListChecks className="-mt-0.5 mr-1 inline size-4" />
                  Per-label Kappa
                </summary>
                <table className="mt-2 w-full text-left">
                  <thead className="text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="py-1">Label</th>
                      <th className="py-1 text-right">Kappa</th>
                      <th className="py-1 text-right">Support</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.perLabel
                      .slice()
                      .sort((a, b) => a.kappa - b.kappa)
                      .map((entry) => (
                        <tr key={entry.label} className="border-t border-border/40">
                          <td className="py-1 font-mono text-xs">{entry.label}</td>
                          <td className="py-1 text-right font-mono">
                            {entry.kappa.toFixed(3)}
                          </td>
                          <td className="py-1 text-right text-muted-foreground">
                            {entry.support}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </details>
            ) : null}

            {result.topConfused.length > 0 ? (
              <details className="mt-3 text-sm">
                <summary className="cursor-pointer text-muted-foreground">
                  Top confused pairs
                </summary>
                <ul className="mt-2 space-y-1 font-mono text-xs">
                  {result.topConfused.map((pair, i) => (
                    <li key={`${pair.aiLabel}|${pair.humanLabel}|${i}`}>
                      AI <strong>{pair.aiLabel}</strong> → Human{" "}
                      <strong>{pair.humanLabel}</strong>{" "}
                      <span className="text-muted-foreground">
                        × {pair.count}
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
          </article>
        ))}
      </section>
    </div>
  );
}
