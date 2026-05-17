"use client";

export interface GrowthSnapshot {
  date: string;
  interests: Record<string, number>; // dimension -> score (0-100)
}

interface GrowthTimelineProps {
  snapshots: GrowthSnapshot[];
}

const LINE_COLORS = [
  "var(--primary)",        // blue
  "var(--secondary)",      // yellow
  "var(--green-leaf-deep)",// green
  "var(--pink-bloom)",     // pink
  "var(--lavender-mist)",  // lavender
];

export function GrowthTimeline({ snapshots }: GrowthTimelineProps) {
  if (snapshots.length < 2) return null;

  const dimensions = Object.keys(snapshots[0].interests);
  const padX = 48;
  const padY = 24;
  const padBottom = 40;
  const width = 500;
  const height = 220;
  const chartW = width - padX * 2;
  const chartH = height - padY - padBottom;

  const xStep = chartW / (snapshots.length - 1);

  function y(score: number) {
    return padY + chartH - (score / 100) * chartH;
  }

  // Format date label
  function formatDate(d: string) {
    const date = new Date(d);
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }

  return (
    <div className="rounded-xl border bg-card p-5">
      <h3 className="mb-1 text-sm font-semibold uppercase tracking-wider text-primary">
        How Interests Have Grown
      </h3>
      <p className="mb-4 text-xs text-muted-foreground">
        Changes in your child&apos;s interest profile over time
      </p>

      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full min-w-[400px]">
          {/* Y-axis grid lines */}
          {[0, 25, 50, 75, 100].map((v) => (
            <g key={v}>
              <line
                x1={padX}
                y1={y(v)}
                x2={width - padX}
                y2={y(v)}
                stroke="var(--border)"
                strokeWidth={0.8}
                strokeDasharray={v === 0 ? "none" : "4 3"}
                opacity={0.5}
              />
              <text
                x={padX - 8}
                y={y(v)}
                textAnchor="end"
                dominantBaseline="middle"
                className="fill-muted-foreground text-[9px]"
              >
                {v}
              </text>
            </g>
          ))}

          {/* Lines per dimension */}
          {dimensions.map((dim, di) => {
            const color = LINE_COLORS[di % LINE_COLORS.length];
            const pathData = snapshots
              .map((s, si) => {
                const px = padX + si * xStep;
                const py = y(s.interests[dim] ?? 0);
                return `${si === 0 ? "M" : "L"} ${px} ${py}`;
              })
              .join(" ");

            return (
              <g key={dim}>
                <path
                  d={pathData}
                  fill="none"
                  stroke={color}
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {snapshots.map((s, si) => (
                  <circle
                    key={si}
                    cx={padX + si * xStep}
                    cy={y(s.interests[dim] ?? 0)}
                    r={3}
                    fill={color}
                    stroke="white"
                    strokeWidth={1.5}
                  />
                ))}
              </g>
            );
          })}

          {/* X-axis date labels */}
          {snapshots.map((s, si) => (
            <text
              key={si}
              x={padX + si * xStep}
              y={height - 10}
              textAnchor="middle"
              className="fill-muted-foreground text-[9px]"
            >
              {formatDate(s.date)}
            </text>
          ))}
        </svg>
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap gap-4">
        {dimensions.map((dim, di) => (
          <div key={dim} className="flex items-center gap-1.5">
            <div
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: LINE_COLORS[di % LINE_COLORS.length] }}
            />
            <span className="text-xs text-muted-foreground">{dim}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
