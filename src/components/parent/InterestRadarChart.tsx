import type { InterestKey } from "@/lib/interests/taxonomy";

/**
 * Spec ref: Katalis.docx §7.1 — "Interest Radar Chart: A visual spider chart
 * showing the child's top 3-5 interest dimensions with confidence scores."
 *
 * Pure SVG radar — no chart library dependency. Renders the top 3-5 interest
 * keys as a polygon overlay on a 4-ring grid. Each axis represents one
 * interest; the radial position encodes the combined (score × confidence)
 * value, clipped to 0..1.
 */

type RadarPoint = {
  interestKey: InterestKey;
  score: number;
  confidence: number;
  label: string;
};

interface Props {
  interests: ReadonlyArray<{
    interestKey: InterestKey;
    score: number;
    confidence: number;
  }>;
  size?: number;
  ringCount?: number;
  className?: string;
}

function formatLabel(key: string): string {
  return key
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function InterestRadarChart({
  interests,
  size = 280,
  ringCount = 4,
  className,
}: Props) {
  const points: RadarPoint[] = interests.slice(0, 5).map((i) => ({
    interestKey: i.interestKey,
    score: Math.min(1, Math.max(0, i.score)),
    confidence: Math.min(1, Math.max(0, i.confidence)),
    label: formatLabel(i.interestKey),
  }));

  if (points.length < 3) {
    return (
      <div
        className={className}
        role="img"
        aria-label="Interest radar chart"
      >
        <p className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
          Once your child has at least 3 interest signals, a radar chart shows
          how their interests balance out.
        </p>
      </div>
    );
  }

  const cx = size / 2;
  const cy = size / 2;
  const radius = (size / 2) * 0.78;
  const angleStep = (Math.PI * 2) / points.length;
  const startAngle = -Math.PI / 2;

  const axisLines = points.map((point, i) => {
    const a = startAngle + i * angleStep;
    const x = cx + Math.cos(a) * radius;
    const y = cy + Math.sin(a) * radius;
    return { x, y, key: point.interestKey };
  });

  const ringPolygons: string[] = [];
  for (let r = 1; r <= ringCount; r++) {
    const rRatio = r / ringCount;
    const coords = points.map((_, i) => {
      const a = startAngle + i * angleStep;
      const x = cx + Math.cos(a) * radius * rRatio;
      const y = cy + Math.sin(a) * radius * rRatio;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    ringPolygons.push(coords.join(" "));
  }

  const dataCoords = points.map((point, i) => {
    const a = startAngle + i * angleStep;
    const value = point.score * point.confidence;
    const x = cx + Math.cos(a) * radius * value;
    const y = cy + Math.sin(a) * radius * value;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  return (
    <figure
      className={className}
      aria-label="Interest radar chart showing top interest dimensions and confidence"
    >
      <svg
        viewBox={`0 0 ${size} ${size}`}
        width="100%"
        height="auto"
        className="text-foreground"
      >
        {/* Grid rings */}
        {ringPolygons.map((coords, idx) => (
          <polygon
            key={`ring-${idx}`}
            points={coords}
            fill="none"
            stroke="currentColor"
            strokeOpacity={0.15}
            strokeWidth={1}
          />
        ))}

        {/* Axis spokes */}
        {axisLines.map((line) => (
          <line
            key={`axis-${line.key}`}
            x1={cx}
            y1={cy}
            x2={line.x}
            y2={line.y}
            stroke="currentColor"
            strokeOpacity={0.15}
            strokeWidth={1}
          />
        ))}

        {/* Data polygon */}
        <polygon
          points={dataCoords.join(" ")}
          fill="currentColor"
          fillOpacity={0.18}
          stroke="currentColor"
          strokeOpacity={0.7}
          strokeWidth={2}
        />

        {/* Data points */}
        {points.map((point, i) => {
          const a = startAngle + i * angleStep;
          const value = point.score * point.confidence;
          const x = cx + Math.cos(a) * radius * value;
          const y = cy + Math.sin(a) * radius * value;
          return (
            <circle
              key={`pt-${point.interestKey}`}
              cx={x}
              cy={y}
              r={3.5}
              fill="currentColor"
            />
          );
        })}

        {/* Labels */}
        {points.map((point, i) => {
          const a = startAngle + i * angleStep;
          const lx = cx + Math.cos(a) * (radius + 18);
          const ly = cy + Math.sin(a) * (radius + 18);
          const anchor =
            Math.abs(Math.cos(a)) < 0.3
              ? "middle"
              : Math.cos(a) > 0
                ? "start"
                : "end";
          return (
            <text
              key={`lbl-${point.interestKey}`}
              x={lx}
              y={ly}
              fontSize={11}
              fontWeight={500}
              fill="currentColor"
              textAnchor={anchor}
              dominantBaseline="middle"
            >
              {point.label}
              <tspan
                x={lx}
                dy={12}
                fontSize={10}
                fontWeight={400}
                fillOpacity={0.6}
              >
                {Math.round(point.confidence * 100)}% confidence
              </tspan>
            </text>
          );
        })}
      </svg>
      <figcaption className="mt-2 text-xs text-muted-foreground">
        Each axis is one interest; distance from the center reflects how
        strongly we're currently seeing it. Interests change over time.
      </figcaption>
    </figure>
  );
}
