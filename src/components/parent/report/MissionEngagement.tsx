"use client";

export interface EngagementData {
  completionRate: number; // 0-100
  totalMissions: number;
  completedMissions: number;
  averageTimeMinutes?: number;
  creativityBadges: string[];
  streakDays?: number;
}

interface MissionEngagementProps {
  engagement: EngagementData;
}

function ProgressRing({ value, size = 80 }: { value: number; size?: number }) {
  const strokeWidth = 7;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;

  return (
    <svg width={size} height={size} className="shrink-0">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="var(--muted)"
        strokeWidth={strokeWidth}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="var(--green-leaf-deep)"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        className="transition-all duration-700"
      />
      <text
        x={size / 2}
        y={size / 2}
        textAnchor="middle"
        dominantBaseline="middle"
        className="fill-foreground text-sm font-bold"
      >
        {value}%
      </text>
    </svg>
  );
}

export function MissionEngagement({ engagement }: MissionEngagementProps) {
  return (
    <div className="rounded-xl border bg-card p-5">
      <h3 className="mb-1 text-sm font-semibold uppercase tracking-wider text-primary">
        Mission Progress
      </h3>
      <p className="mb-4 text-xs text-muted-foreground">
        How your child is doing with their missions
      </p>

      <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
        {/* Progress ring */}
        <div className="flex flex-col items-center gap-1">
          <ProgressRing value={engagement.completionRate} />
          <span className="text-xs font-medium text-muted-foreground">Completed</span>
        </div>

        {/* Stats grid */}
        <div className="grid flex-1 grid-cols-2 gap-3">
          <div className="rounded-lg bg-muted/50 p-3">
            <p className="text-lg font-bold text-foreground">
              {engagement.completedMissions}
              <span className="text-sm font-normal text-muted-foreground">
                /{engagement.totalMissions}
              </span>
            </p>
            <p className="text-xs text-muted-foreground">Missions done</p>
          </div>

          {engagement.averageTimeMinutes !== undefined && (
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="text-lg font-bold text-foreground">
                {engagement.averageTimeMinutes}
                <span className="text-sm font-normal text-muted-foreground"> min</span>
              </p>
              <p className="text-xs text-muted-foreground">Avg. time per mission</p>
            </div>
          )}

          {engagement.streakDays !== undefined && (
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="text-lg font-bold text-foreground">
                {engagement.streakDays}
                <span className="text-sm font-normal text-muted-foreground"> days</span>
              </p>
              <p className="text-xs text-muted-foreground">Current streak</p>
            </div>
          )}

          {engagement.creativityBadges.length > 0 && (
            <div className="rounded-lg bg-secondary/10 p-3">
              <p className="text-lg font-bold text-secondary-foreground">
                {engagement.creativityBadges.length}
              </p>
              <p className="text-xs text-muted-foreground">Creativity badges</p>
            </div>
          )}
        </div>
      </div>

      {/* Creativity badges */}
      {engagement.creativityBadges.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {engagement.creativityBadges.map((badge) => (
            <span
              key={badge}
              className="inline-flex items-center rounded-full bg-secondary/15 px-2.5 py-0.5 text-xs font-medium text-secondary-foreground"
            >
              {badge.replace(/_/g, " ")}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
