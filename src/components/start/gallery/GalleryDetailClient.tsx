import { useState, useCallback } from "react";
import { m } from "@/paraglide/messages";
import { LocaleLink } from "@/i18n/start-navigation";
import { flagGalleryEntryFn, likeGalleryEntryFn, addGalleryCommentFn } from "@/lib/server/gallery";
import { getTalentCategoryColor } from "@/types/gallery";

interface GalleryComment {
  id: string;
  content: string;
  authorName: string;
  createdAt: string;
  isOwn: boolean;
}

interface GalleryDetailEntry {
  id: string;
  imageUrl: string;
  caption: string | null;
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
  likesCount: number;
  userHasLiked: boolean;
  comments: GalleryComment[];
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
  const [flagResult, setFlagResult] = useState<"success" | "error" | null>(null);

  const [liked, setLiked] = useState(entry.userHasLiked);
  const [likesCount, setLikesCount] = useState(entry.likesCount);
  const [likeLoading, setLikeLoading] = useState(false);
  const [likeError, setLikeError] = useState(false);

  const [comments, setComments] = useState<GalleryComment[]>(entry.comments);
  const [commentText, setCommentText] = useState("");
  const [commentLoading, setCommentLoading] = useState(false);
  const [commentError, setCommentError] = useState(false);

  const handleLike = useCallback(async () => {
    if (likeLoading) return;
    setLikeLoading(true);
    setLikeError(false);
    try {
      const res = await likeGalleryEntryFn({ data: { entryId: entry.id } });
      if (!res.ok) throw new Error();
      setLiked(res.liked);
      setLikesCount(res.likesCount);
    } catch {
      setLikeError(true);
    } finally {
      setLikeLoading(false);
    }
  }, [entry.id, likeLoading]);

  const handleComment = useCallback(async () => {
    if (!commentText.trim() || commentLoading) return;
    setCommentLoading(true);
    setCommentError(false);
    try {
      const res = await addGalleryCommentFn({ data: { entryId: entry.id, content: commentText.trim() } });
      if (!res.ok) throw new Error();
      setComments((prev) => [...prev, res]);
      setCommentText("");
    } catch {
      setCommentError(true);
    } finally {
      setCommentLoading(false);
    }
  }, [entry.id, commentText, commentLoading]);

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
          {/* Caption */}
          {entry.caption && (
            <p className="text-base italic text-foreground">"{entry.caption}"</p>
          )}

          {/* Like button */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleLike}
              disabled={likeLoading}
              className={`flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors ${liked ? "border-pink-400 bg-pink-50 text-pink-600" : "border-muted-foreground/30 bg-muted text-muted-foreground hover:border-pink-400 hover:bg-pink-50 hover:text-pink-600"}`}
              aria-pressed={liked}
            >
              <svg className={`h-4 w-4 ${liked ? "fill-pink-500 stroke-pink-500" : "fill-none stroke-current"}`} viewBox="0 0 24 24" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" />
              </svg>
              {liked ? m.gallery_detail_liked() : m.gallery_detail_like()}
              <span className="ml-0.5 tabular-nums">{likesCount}</span>
            </button>
            {likeError && <span className="text-xs text-red-500">{m.gallery_detail_likeError()}</span>}
          </div>

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

          {/* Comments */}
          <div className="border-t pt-4">
            <h3 className="mb-3 text-sm font-semibold">{m.gallery_detail_comments()}</h3>
            {comments.length === 0 ? (
              <p className="mb-3 text-sm text-muted-foreground">{m.gallery_detail_commentEmpty()}</p>
            ) : (
              <ul className="mb-3 space-y-2">
                {comments.map((c) => (
                  <li key={c.id} className="flex items-start gap-2 text-sm">
                    <span className="font-semibold text-foreground shrink-0">{c.authorName}</span>
                    <span className="text-muted-foreground">{c.content}</span>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex gap-2">
              <input
                type="text"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleComment(); }}
                placeholder={m.gallery_detail_commentPlaceholder()}
                maxLength={200}
                className="flex-1 rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <button
                onClick={handleComment}
                disabled={commentLoading || !commentText.trim()}
                className="rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground transition-opacity disabled:opacity-50"
              >
                {m.gallery_detail_commentSubmit()}
              </button>
            </div>
            {commentError && <p className="mt-1 text-xs text-red-500">{m.gallery_detail_commentError()}</p>}
          </div>
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
