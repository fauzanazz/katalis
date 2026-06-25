import { useState } from "react";
import { m } from "@/paraglide/messages";
import { LocaleLink } from "@/i18n/start-navigation";
import { flagGalleryEntryFn } from "@/lib/server/gallery";
import { getTalentCategoryColor } from "@/types/gallery";

interface GalleryDetailEntry {
  id: string;
  imageUrl: string;
  talentCategory: string;
  talentConfidence: number | null;
  detectedTalents: Array<{ name: string; confidence: number }> | null;
  talentTags: Array<{ name: string; confidence: number; category: string }> | null;
  artworkStory: string | null;
  country: string | null;
  coordinates: { lat: number; lng: number } | null;
  questContext: {
    questTitle?: string;
    dream?: string;
    localContext?: string;
    missionSummaries?: string[];
  } | null;
  journey: {
    missionCount: number | null;
    proofPhotoCount: number | null;
    questDurationDays: number | null;
  };
  createdAt: string;
}

interface GalleryDetailClientProps {
  entry: GalleryDetailEntry;
}

type FlagReason = "inappropriate" | "offensive" | "spam" | "other";

export function GalleryDetailClient({ entry }: GalleryDetailClientProps) {
  const [showFlagDialog, setShowFlagDialog] = useState(false);
  const [flagReason, setFlagReason] = useState<FlagReason>("inappropriate");
  const [flagDetails, setFlagDetails] = useState("");
  const [flagLoading, setFlagLoading] = useState(false);
  const [flagResult, setFlagResult] = useState<"success" | "error" | null>(
    null,
  );

  const handleFlagSubmit = async () => {
    setFlagLoading(true);
    setFlagResult(null);
    try {
      const res = await flagGalleryEntryFn({
        data: {
          entryId: entry.id,
          reason: flagReason,
          details: flagDetails || undefined,
        },
      });
      if (!res.ok) throw new Error("Failed to submit flag");
      setFlagResult("success");
      setTimeout(() => {
        setShowFlagDialog(false);
        setFlagResult(null);
        setFlagDetails("");
      }, 2000);
    } catch {
      setFlagResult("error");
    } finally {
      setFlagLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      {/* Back navigation */}
      <LocaleLink
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
        {m.gallery_detail_backToGallery()}
      </LocaleLink>

      {/* Main image */}
      <div className="overflow-hidden rounded-lg border bg-card shadow-sm">
        <div className="relative aspect-video w-full overflow-hidden bg-muted">
          <img
            src={entry.imageUrl}
            alt={m.gallery_detail_imageAlt({
              category: entry.talentCategory,
              country: entry.country ?? "",
            })}
            className="h-full w-full object-contain"
            loading="eager"
          />
        </div>

        <div className="space-y-4 p-4 sm:p-6">
          {/* Talent category */}
          <div className="flex items-center justify-between">
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

            {/* Content flag button */}
            <button
              onClick={() => setShowFlagDialog(true)}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label={m.gallery_detail_flagContent()}
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 3v1.5M3 21v-6m0 0 2.77-.693a9 9 0 0 1 6.208.682l.108.054a9 9 0 0 0 6.086.71l3.114-.732a48.524 48.524 0 0 1-.005-10.499l-3.11.732a9 9 0 0 1-6.085-.711l-.108-.054a9 9 0 0 0-6.208-.682L3 4.5M3 15V4.5"
                />
              </svg>
              {m.gallery_detail_flagContent()}
            </button>
          </div>

          {/* Country/Location */}
          {entry.country && (
            <div>
              <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {m.gallery_detail_countryLabel()}
              </h3>
              <p className="mt-0.5 text-sm">{entry.country}</p>
            </div>
          )}

          {/* Artist's note — the child's own words about their work */}
          {entry.artworkStory && (
            <div>
              <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {m.gallery_detail_storyLabel()}
              </h3>
              <p className="mt-1 text-sm italic text-foreground">
                &ldquo;{entry.artworkStory}&rdquo;
              </p>
            </div>
          )}

          {/* Talent tags */}
          {entry.talentTags && entry.talentTags.length > 0 && (
            <div>
              <h3 className="mb-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {m.gallery_detail_talentTagsLabel()}
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {entry.talentTags.map((tag, index) => (
                  <span
                    key={`${tag.name}-${index}`}
                    className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-foreground"
                  >
                    {tag.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Talents sparked — detected talents with confidence */}
          {entry.detectedTalents && entry.detectedTalents.length > 0 && (
            <div>
              <h3 className="mb-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {m.gallery_detail_talentsLabel()}
              </h3>
              <ul className="space-y-1.5">
                {entry.detectedTalents.map((talent, index) => {
                  const percent = Math.round((talent.confidence ?? 0) * 100);
                  return (
                    <li key={`${talent.name}-${index}`} className="text-sm">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-foreground">
                          {talent.name}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {percent}%
                        </span>
                      </div>
                      <div className="mt-0.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${percent}%`,
                            backgroundColor: getTalentCategoryColor(
                              entry.talentCategory,
                            ),
                          }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* Journey stats — effort + persistence behind the work */}
          {(entry.journey.missionCount != null ||
            entry.journey.proofPhotoCount != null ||
            entry.journey.questDurationDays != null) && (
            <div className="grid grid-cols-3 gap-2">
              {entry.journey.missionCount != null && (
                <div className="rounded-lg border bg-muted/30 p-2 text-center">
                  <p className="text-lg font-bold text-foreground">
                    {entry.journey.missionCount}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {m.gallery_detail_missionsDone()}
                  </p>
                </div>
              )}
              {entry.journey.proofPhotoCount != null && (
                <div className="rounded-lg border bg-muted/30 p-2 text-center">
                  <p className="text-lg font-bold text-foreground">
                    {entry.journey.proofPhotoCount}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {m.gallery_detail_photosShared()}
                  </p>
                </div>
              )}
              {entry.journey.questDurationDays != null && (
                <div className="rounded-lg border bg-muted/30 p-2 text-center">
                  <p className="text-lg font-bold text-foreground">
                    {entry.journey.questDurationDays}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {m.gallery_detail_daysSpent()}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Quest context */}
          {entry.questContext && (
            <div className="rounded-lg border bg-muted/30 p-4">
              <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {m.gallery_detail_questContextLabel()}
              </h3>

              {entry.questContext.dream && (
                <div className="mb-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    {m.gallery_detail_dreamLabel()}
                  </p>
                  <p className="text-sm">{entry.questContext.dream}</p>
                </div>
              )}

              {entry.questContext.localContext && (
                <div className="mb-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    {m.gallery_detail_localContextLabel()}
                  </p>
                  <p className="text-sm">{entry.questContext.localContext}</p>
                </div>
              )}

              {entry.questContext.missionSummaries &&
                entry.questContext.missionSummaries.length > 0 && (
                  <div>
                    <p className="mb-1 text-xs font-medium text-muted-foreground">
                      {m.gallery_detail_missionsLabel()}
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
            {m.gallery_detail_createdAt({
              date: new Date(entry.createdAt).toLocaleDateString(),
            })}
          </p>
        </div>
      </div>

      {/* Content flag dialog */}
      {showFlagDialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={m.gallery_detail_flagContent()}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowFlagDialog(false);
          }}
        >
          <div className="w-full max-w-md rounded-lg bg-card p-6 shadow-lg">
            <h3 className="mb-4 text-lg font-semibold">
              {m.gallery_detail_flagContent()}
            </h3>

            {flagResult === "success" ? (
              <p className="text-sm text-green-600">
                {m.gallery_detail_flagSuccess()}
              </p>
            ) : (
              <>
                {/* Flag reason */}
                <div className="mb-4">
                  <label
                    htmlFor="flag-reason"
                    className="mb-1 block text-sm font-medium"
                  >
                    {m.gallery_detail_flagReasonLabel()}
                  </label>
                  <select
                    id="flag-reason"
                    value={flagReason}
                    onChange={(e) =>
                      setFlagReason(e.target.value as FlagReason)
                    }
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                    aria-label={m.gallery_detail_flagReasonLabel()}
                  >
                    <option value="inappropriate">
                      {m.gallery_detail_flagReasons_inappropriate()}
                    </option>
                    <option value="offensive">
                      {m.gallery_detail_flagReasons_offensive()}
                    </option>
                    <option value="spam">
                      {m.gallery_detail_flagReasons_spam()}
                    </option>
                    <option value="other">
                      {m.gallery_detail_flagReasons_other()}
                    </option>
                  </select>
                </div>

                {/* Details */}
                <div className="mb-4">
                  <label
                    htmlFor="flag-details"
                    className="mb-1 block text-sm font-medium"
                  >
                    {m.gallery_detail_flagDetailsLabel()}
                  </label>
                  <textarea
                    id="flag-details"
                    value={flagDetails}
                    onChange={(e) => setFlagDetails(e.target.value)}
                    maxLength={500}
                    rows={3}
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                    aria-label={m.gallery_detail_flagDetailsLabel()}
                  />
                </div>

                {/* Error */}
                {flagResult === "error" && (
                  <p className="mb-3 text-sm text-red-600">
                    {m.gallery_detail_flagError()}
                  </p>
                )}

                {/* Actions */}
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => {
                      setShowFlagDialog(false);
                      setFlagResult(null);
                      setFlagDetails("");
                    }}
                    className="rounded-md px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted"
                    disabled={flagLoading}
                  >
                    {m.gallery_detail_flagCancel()}
                  </button>
                  <button
                    onClick={handleFlagSubmit}
                    disabled={flagLoading}
                    className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
                  >
                    {flagLoading ? "..." : m.gallery_detail_flagSubmit()}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
