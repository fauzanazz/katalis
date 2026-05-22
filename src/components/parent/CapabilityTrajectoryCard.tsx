import type { ZpdBand } from "@/lib/zpd";

type Snapshot = {
  id: string;
  score: number;
  band: string;
  createdAt: string;
};

type Labels = {
  title: string;
  placeholder: string;
  bands: Record<ZpdBand, string>;
};

type Props = {
  childId: string;
  snapshots: Snapshot[];
  labels: Labels;
};

const CHART_WIDTH = 200;
const CHART_HEIGHT = 48;
const POINT_RADIUS = 3;

export function CapabilityTrajectoryCard({ snapshots, labels }: Props) {
  if (snapshots.length === 0) {
    return (
      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-slate-900">
          {labels.title}
        </h3>
        <p className="mt-2 text-xs text-slate-500">
          {labels.placeholder}
        </p>
      </section>
    );
  }

  const latest = snapshots[snapshots.length - 1];
  const latestBand = (latest.band as ZpdBand) in labels.bands
    ? labels.bands[latest.band as ZpdBand]
    : latest.band;

  const xs = snapshots.map((_, i) =>
    snapshots.length === 1
      ? CHART_WIDTH / 2
      : (i / (snapshots.length - 1)) * (CHART_WIDTH - POINT_RADIUS * 2) +
        POINT_RADIUS,
  );
  const ys = snapshots.map(
    (s) =>
      CHART_HEIGHT -
      POINT_RADIUS -
      Math.max(0, Math.min(1, s.score)) * (CHART_HEIGHT - POINT_RADIUS * 2),
  );

  const path = xs
    .map((x, i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${ys[i].toFixed(1)}`)
    .join(" ");

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <header className="flex items-baseline justify-between">
        <h3 className="text-sm font-semibold text-slate-900">
          {labels.title}
        </h3>
        <span className="text-xs font-medium text-emerald-600">
          {latestBand}
        </span>
      </header>
      <svg
        className="mt-2 w-full"
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        role="img"
        aria-label={labels.title}
      >
        <path
          d={path}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          className="text-emerald-500"
        />
        {snapshots.map((snapshot, i) => (
          <circle
            key={snapshot.id}
            data-testid="zpd-point"
            cx={xs[i]}
            cy={ys[i]}
            r={POINT_RADIUS}
            className="fill-emerald-600"
          />
        ))}
      </svg>
    </section>
  );
}
