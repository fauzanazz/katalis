"use client";

export interface InterestDimension {
  label: string;
  score: number; // 0-100
}

interface InterestRadarChartProps {
  interests: InterestDimension[];
}

export function InterestRadarChart({ interests }: InterestRadarChartProps) {
  if (interests.length < 3) return null;

  const cx = 150;
  const cy = 150;
  const maxR = 110;
  const levels = 4;
  const count = interests.length;
  const angleStep = (2 * Math.PI) / count;

  function polarToXY(angle: number, radius: number) {
    return {
      x: cx + radius * Math.cos(angle - Math.PI / 2),
      y: cy + radius * Math.sin(angle - Math.PI / 2),
    };
  }

  // Grid rings
  const rings = Array.from({ length: levels }, (_, i) => {
    const r = (maxR / levels) * (i + 1);
    const points = Array.from({ length: count }, (_, j) => {
      const p = polarToXY(j * angleStep, r);
      return `${p.x},${p.y}`;
    }).join(" ");
    return points;
  });

  // Axis lines
  const axes = Array.from({ length: count }, (_, i) => {
    const p = polarToXY(i * angleStep, maxR);
    return { x2: p.x, y2: p.y };
  });

  // Data polygon
  const dataPoints = interests.map((d, i) => {
    const r = (d.score / 100) * maxR;
    return polarToXY(i * angleStep, r);
  });
  const dataPolygon = dataPoints.map((p) => `${p.x},${p.y}`).join(" ");

  // Labels
  const labels = interests.map((d, i) => {
    const p = polarToXY(i * angleStep, maxR + 22);
    return { ...p, text: d.label, score: d.score };
  });

  return (
    <div className="rounded-xl border bg-card p-5">
      <h3 className="mb-1 text-sm font-semibold uppercase tracking-wider text-primary">
        What Excites Your Child
      </h3>
      <p className="mb-4 text-xs text-muted-foreground">
        Top interests based on recent activities
      </p>

      <div className="flex justify-center">
        <svg viewBox="0 0 300 300" className="w-full max-w-[320px]">
          {/* Grid rings */}
          {rings.map((points, i) => (
            <polygon
              key={i}
              points={points}
              fill="none"
              stroke="var(--border)"
              strokeWidth={i === levels - 1 ? 1.5 : 0.8}
              opacity={0.6}
            />
          ))}

          {/* Axis lines */}
          {axes.map((a, i) => (
            <line
              key={i}
              x1={cx}
              y1={cy}
              x2={a.x2}
              y2={a.y2}
              stroke="var(--border)"
              strokeWidth={0.8}
              opacity={0.5}
            />
          ))}

          {/* Data area */}
          <polygon
            points={dataPolygon}
            fill="var(--primary)"
            fillOpacity={0.15}
            stroke="var(--primary)"
            strokeWidth={2}
          />

          {/* Data points */}
          {dataPoints.map((p, i) => (
            <circle
              key={i}
              cx={p.x}
              cy={p.y}
              r={4}
              fill="var(--primary)"
              stroke="white"
              strokeWidth={1.5}
            />
          ))}

          {/* Labels */}
          {labels.map((l, i) => (
            <text
              key={i}
              x={l.x}
              y={l.y}
              textAnchor="middle"
              dominantBaseline="middle"
              className="fill-foreground text-[10px] font-medium"
            >
              {l.text}
            </text>
          ))}
        </svg>
      </div>

      {/* Score legend */}
      <div className="mt-3 flex flex-wrap justify-center gap-3">
        {interests.map((d) => (
          <div key={d.label} className="flex items-center gap-1.5">
            <div
              className="h-2 rounded-full bg-primary"
              style={{ width: `${Math.max(d.score * 0.4, 8)}px` }}
            />
            <span className="text-xs text-muted-foreground">
              {d.label}: <span className="font-semibold text-foreground">{d.score}%</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
