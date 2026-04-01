"use client";

import { useState } from "react";
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
    localContext?: string;
    missionSummaries?: string[];
  } | null;
  createdAt: string;
}

interface GalleryDetailClientProps {
  entry: GalleryDetailEntry;
}

type FlagReason = "inappropriate" | "offensive" | "spam" | "other";

export function GalleryDetailClient({ entry }: GalleryDetailClientProps) {
  const t = useTranslations("gallery");
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
      const response = await fetch("/api/gallery/flag", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entryId: entry.id,
          reason: flagReason,
          details: flagDetails || undefined,
        }),
      });
      if (!response.ok) throw new Error("Failed to submit flag");
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
              aria-label={t("detail.flagContent")}
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
              {t("detail.flagContent")}
            </button>
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

              {entry.questContext.localContext && (
                <div className="mb-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    {t("detail.localContextLabel")}
                  </p>
                  <p className="text-sm">{entry.questContext.localContext}</p>
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

      {/* Content flag dialog */}
      {showFlagDialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={t("detail.flagContent")}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowFlagDialog(false);
          }}
        >
          <div className="w-full max-w-md rounded-lg bg-card p-6 shadow-lg">
            <h3 className="mb-4 text-lg font-semibold">
              {t("detail.flagContent")}
            </h3>

            {flagResult === "success" ? (
              <p className="text-sm text-green-600 dark:text-green-400">
                {t("detail.flagSuccess")}
              </p>
            ) : (
              <>
                {/* Flag reason */}
                <div className="mb-4">
                  <label
                    htmlFor="flag-reason"
                    className="mb-1 block text-sm font-medium"
                  >
                    {t("detail.flagReasonLabel")}
                  </label>
                  <select
                    id="flag-reason"
                    value={flagReason}
                    onChange={(e) =>
                      setFlagReason(e.target.value as FlagReason)
                    }
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                    aria-label={t("detail.flagReasonLabel")}
                  >
                    <option value="inappropriate">
                      {t("detail.flagReasons.inappropriate")}
                    </option>
                    <option value="offensive">
                      {t("detail.flagReasons.offensive")}
                    </option>
                    <option value="spam">
                      {t("detail.flagReasons.spam")}
                    </option>
                    <option value="other">
                      {t("detail.flagReasons.other")}
                    </option>
                  </select>
                </div>

                {/* Details */}
                <div className="mb-4">
                  <label
                    htmlFor="flag-details"
                    className="mb-1 block text-sm font-medium"
                  >
                    {t("detail.flagDetailsLabel")}
                  </label>
                  <textarea
                    id="flag-details"
                    value={flagDetails}
                    onChange={(e) => setFlagDetails(e.target.value)}
                    maxLength={500}
                    rows={3}
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                    aria-label={t("detail.flagDetailsLabel")}
                  />
                </div>

                {/* Error */}
                {flagResult === "error" && (
                  <p className="mb-3 text-sm text-red-600 dark:text-red-400">
                    {t("detail.flagError")}
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
                    {t("detail.flagCancel")}
                  </button>
                  <button
                    onClick={handleFlagSubmit}
                    disabled={flagLoading}
                    className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
                  >
                    {flagLoading ? "..." : t("detail.flagSubmit")}
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
