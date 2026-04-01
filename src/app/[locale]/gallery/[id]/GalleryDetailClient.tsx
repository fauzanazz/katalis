"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { getTalentCategoryColor } from "@/types/gallery";

interface GalleryDetailEntry {
  id: string;
  imageUrl: string;
  talentCategory: string;
  country: string | null;
  coordinates: { lat: number; lng: number } | null;
  questContext: {
    questTitle?: string;
    dream?: string;
    missionSummaries?: string[];
  } | null;
  createdAt: string;
}

interface GalleryDetailClientProps {
  entry: GalleryDetailEntry;
}

export function GalleryDetailClient({ entry }: GalleryDetailClientProps) {
  const t = useTranslations("gallery");

  return (
    <div className="mx-auto max-w-3xl">
      {/* Back navigation */}
      <Link
        href="/gallery"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <svg
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15.75 19.5 8.25 12l7.5-7.5"
          />
        </svg>
        {t("detail.backToGallery")}
      </Link>

      {/* Main image */}
      <div className="overflow-hidden rounded-lg border bg-card shadow-sm">
        <div className="relative aspect-video w-full overflow-hidden bg-muted">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={entry.imageUrl}
            alt={t("detail.imageAlt", {
              category: entry.talentCategory,
              country: entry.country ?? "",
            })}
            className="h-full w-full object-contain"
            loading="eager"
          />
        </div>

        <div className="space-y-4 p-4 sm:p-6">
          {/* Talent category */}
          <div className="flex items-center gap-2">
            <span
              className="inline-block h-4 w-4 rounded-full"
              style={{
                backgroundColor: getTalentCategoryColor(
                  entry.talentCategory,
                ),
              }}
              aria-hidden="true"
            />
            <h2 className="text-lg font-semibold">{entry.talentCategory}</h2>
          </div>

          {/* Country/Location */}
          {entry.country && (
            <div>
              <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {t("detail.countryLabel")}
              </h3>
              <p className="mt-0.5 text-sm">{entry.country}</p>
            </div>
          )}

          {/* Quest context */}
          {entry.questContext && (
            <div className="rounded-lg border bg-muted/30 p-4">
              <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {t("detail.questContextLabel")}
              </h3>

              {entry.questContext.dream && (
                <div className="mb-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    {t("detail.dreamLabel")}
                  </p>
                  <p className="text-sm">{entry.questContext.dream}</p>
                </div>
              )}

              {entry.questContext.missionSummaries &&
                entry.questContext.missionSummaries.length > 0 && (
                  <div>
                    <p className="mb-1 text-xs font-medium text-muted-foreground">
                      {t("detail.missionsLabel")}
                    </p>
                    <ul className="space-y-0.5">
                      {entry.questContext.missionSummaries.map(
                        (summary, index) => (
                          <li
                            key={index}
                            className="flex items-start gap-1.5 text-sm"
                          >
                            <span className="mt-1 text-xs text-muted-foreground">
                              •
                            </span>
                            {summary}
                          </li>
                        ),
                      )}
                    </ul>
                  </div>
                )}
            </div>
          )}

          {/* Created date */}
          <p className="text-xs text-muted-foreground">
            {t("detail.createdAt", {
              date: new Date(entry.createdAt).toLocaleDateString(),
            })}
          </p>
        </div>
      </div>
    </div>
  );
}
