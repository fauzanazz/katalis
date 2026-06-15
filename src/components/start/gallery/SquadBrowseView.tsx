import { useState, useEffect, useCallback } from "react";
import { m } from "@/paraglide/messages";
import { LocaleLink } from "@/i18n/start-navigation";
import { getTalentCategoryColor } from "@/types/gallery";
import { listSquadsFn, getSquadFn } from "@/lib/server/gallery";

interface SquadSummary {
  id: string;
  name: string;
  theme: string;
  description: string;
  icon: string;
  countries: string[];
  memberCount: number;
  entryCount: number;
  status: string;
}

interface SquadEntry {
  id: string;
  imageUrl: string;
  talentCategory: string;
  country: string | null;
  questContext: unknown | null;
  createdAt: string;
}

interface SquadDetailData extends SquadSummary {
  entries: SquadEntry[];
}

interface SquadBrowseViewProps {
  selectedSquadId: string | null;
  onSquadSelect: (squadId: string | null) => void;
}

export function SquadBrowseView({
  selectedSquadId,
  onSquadSelect,
}: SquadBrowseViewProps) {
  const [squads, setSquads] = useState<SquadSummary[]>([]);
  const [detail, setDetail] = useState<SquadDetailData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSquads = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await listSquadsFn();
      if (!res.ok) throw new Error("Failed to load squads");
      setSquads(res.squads ?? []);
    } catch (err) {
      console.error("Failed to fetch squads:", err);
      setError(err instanceof Error ? err.message : "Failed to load squads");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSquads();
  }, [fetchSquads]);

  useEffect(() => {
    if (!selectedSquadId) {
      setDetail(null);
      return;
    }

    const fetchDetail = async () => {
      try {
        const res = await getSquadFn({ data: { squadId: selectedSquadId } });
        if (!res.ok) return;
        setDetail(res.squad as SquadDetailData);
      } catch (err) {
        console.error("Failed to fetch squad detail:", err);
      }
    };

    fetchDetail();
  }, [selectedSquadId]);

  if (isLoading) {
    return (
      <div
        className="flex min-h-[300px] items-center justify-center rounded-lg bg-muted/50"
        role="status"
        aria-label={m.gallery_squads_loading()}
      >
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">{m.gallery_squads_loading()}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4">
        <p className="text-sm text-red-800">{m.gallery_squads_error()}</p>
        <button
          onClick={fetchSquads}
          className="mt-2 text-sm font-medium text-red-700 underline hover:text-red-900"
        >
          {m.gallery_squads_retry()}
        </button>
      </div>
    );
  }

  if (squads.length === 0) {
    return (
      <div className="rounded-lg border bg-muted/30 p-6 text-center">
        <p className="text-sm text-muted-foreground">{m.gallery_squads_empty()}</p>
      </div>
    );
  }

  if (selectedSquadId && detail) {
    return (
      <div role="region" aria-label={m.gallery_squads_squadDetail({ name: detail.name })}>
        <button
          onClick={() => onSquadSelect(null)}
          className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
          {m.gallery_squads_backToSquads()}
        </button>

        <div className="mb-4">
          <div className="flex items-center gap-2">
            <span className="text-2xl" aria-hidden="true">{detail.icon}</span>
            <h2 className="text-lg font-semibold">{detail.name}</h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{detail.description}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
              {m.gallery_squads_membersCount({ count: detail.memberCount })}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
              {m.gallery_squads_worksCount({ count: detail.entryCount })}
            </span>
            {detail.countries.map((country) => (
              <span key={country} className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                {country}
              </span>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {detail.entries.map((entry) => (
            <LocaleLink
              key={entry.id}
              href={`/gallery/${entry.id}`}
              className="group overflow-hidden rounded-lg border bg-card transition-shadow hover:shadow-md"
            >
              <div className="relative aspect-video overflow-hidden">
                <img
                  src={entry.imageUrl}
                  alt={`${entry.talentCategory} work from ${entry.country ?? "unknown"}`}
                  className="h-full w-full object-cover transition-transform group-hover:scale-105"
                  loading="lazy"
                />
              </div>
              <div className="p-3">
                <div className="flex items-center gap-2">
                  <span
                    className="inline-block h-3 w-3 rounded-full"
                    style={{ backgroundColor: getTalentCategoryColor(entry.talentCategory) }}
                    aria-hidden="true"
                  />
                  <span className="text-sm font-medium">{entry.talentCategory}</span>
                </div>
                {entry.country && (
                  <p className="mt-1 text-xs text-muted-foreground">{entry.country}</p>
                )}
              </div>
            </LocaleLink>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div role="region" aria-label={m.gallery_squads_ariaLabel()}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {squads.map((squad) => (
          <button
            key={squad.id}
            onClick={() => onSquadSelect(squad.id)}
            className="group rounded-lg border bg-card p-4 text-left transition-shadow hover:shadow-md"
            aria-label={`${squad.name} - ${m.gallery_squads_membersCount({ count: squad.memberCount })}`}
          >
            <div className="mb-2 flex items-center gap-2">
              <span className="text-xl" aria-hidden="true">{squad.icon}</span>
              <h3 className="font-semibold group-hover:text-primary">{squad.name}</h3>
            </div>
            <p className="mb-3 text-sm text-muted-foreground line-clamp-2">{squad.description}</p>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
                </svg>
                {m.gallery_squads_membersCount({ count: squad.memberCount })}
              </span>
              <div className="flex gap-1">
                {squad.countries.slice(0, 2).map((country) => (
                  <span key={country} className="rounded bg-muted px-1.5 py-0.5">
                    {country}
                  </span>
                ))}
                {squad.countries.length > 2 && (
                  <span className="rounded bg-muted px-1.5 py-0.5">
                    +{squad.countries.length - 2}
                  </span>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
