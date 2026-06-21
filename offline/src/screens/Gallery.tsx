import { useEffect, useRef, useState } from "react";
import { Sparkles, Trash2, X } from "lucide-react";
import { m } from "@/paraglide/messages";
import { Button } from "@/components/ui/button";
import { useApp } from "../app/context";
import { listGallery, addGalleryItem, deleteGalleryItem } from "../data/store";
import { evaluateAwards } from "../data/awards";
import { t, type GalleryItem, type LocalizedText } from "../data/types";
import { STR } from "../strings";
import { aiReachable, artworkFeedback, type ArtworkFeedback } from "../data/ai";
import { downscaleDataUrl } from "../data/image";

const L = {
  confirmDelete: { id: "Yakin hapus?", en: "Confirm?", zh: "确认删除？" },
} satisfies Record<string, LocalizedText>;

export function Gallery() {
  const { profile, locale } = useApp();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [items, setItems] = useState<GalleryItem[]>([]);
  const [pendingDataUrl, setPendingDataUrl] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [feedbackItem, setFeedbackItem] = useState<GalleryItem | null>(null);
  const [feedback, setFeedback] = useState<ArtworkFeedback | null>(null);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [feedbackError, setFeedbackError] = useState<"offline" | "ai" | null>(null);

  useEffect(() => {
    if (!profile) return;
    let active = true;
    listGallery(profile.id).then((rows) => {
      if (!active) return;
      setItems([...rows].sort((a, b) => b.createdAt - a.createdAt));
    });
    return () => {
      active = false;
    };
  }, [profile]);

  if (!profile) return null;

  function reload() {
    listGallery(profile!.id).then((rows) => {
      setItems([...rows].sort((a, b) => b.createdAt - a.createdAt));
    });
  }

  function handleAddClick() {
    fileInputRef.current?.click();
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setPendingDataUrl(reader.result as string);
      setCaption("");
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  async function handleSave() {
    if (!pendingDataUrl) return;
    setSaving(true);
    try {
      await addGalleryItem({
        profileId: profile!.id,
        imageDataUrl: pendingDataUrl,
        caption,
      });
      await evaluateAwards(profile!.id);
      reload();
      setPendingDataUrl(null);
      setCaption("");
    } finally {
      setSaving(false);
    }
  }

  function handleCancelAdd() {
    setPendingDataUrl(null);
    setCaption("");
  }

  async function handleDelete(id: string) {
    if (pendingDelete !== id) {
      setPendingDelete(id);
      return;
    }
    await deleteGalleryItem(id);
    setPendingDelete(null);
    reload();
  }

  async function askKit(item: GalleryItem) {
    setFeedbackItem(item);
    setFeedback(null);
    setFeedbackError(null);
    if (!aiReachable()) {
      setFeedbackError("offline");
      return;
    }
    setFeedbackLoading(true);
    try {
      const image = await downscaleDataUrl(item.imageDataUrl);
      const result = await artworkFeedback(image, {
        locale,
        childName: profile!.name,
        caption: item.caption,
      });
      setFeedback(result);
    } catch {
      setFeedbackError("ai");
    } finally {
      setFeedbackLoading(false);
    }
  }

  function closeFeedback() {
    setFeedbackItem(null);
    setFeedback(null);
    setFeedbackError(null);
  }

  return (
    <div className="flex flex-col gap-5 p-5">
      <header className="pt-2">
        <h1 className="type-h2 text-ink">{m.gallery_title()}</h1>
        <p className="text-muted-foreground">{m.gallery_subtitle()}</p>
      </header>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={handleFileChange}
      />

      {/* Add work button */}
      {!pendingDataUrl && (
        <Button
          onClick={handleAddClick}
          className="w-full active:scale-[0.98]"
        >
          {t(STR.addWork, locale)}
        </Button>
      )}

      {/* Inline caption form after image selected */}
      {pendingDataUrl && (
        <div className="rounded-2xl bg-plain-surface p-4 shadow-sm flex flex-col gap-3">
          <img
            src={pendingDataUrl}
            alt=""
            className="aspect-square w-full rounded-2xl object-cover"
          />
          <input
            type="text"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder={t(STR.caption, locale)}
            className="w-full rounded-xl border border-border bg-muted px-4 py-3 text-base text-ink placeholder:text-muted-foreground focus:outline-none"
          />
          <div className="flex gap-3">
            <Button
              variant="secondary"
              className="flex-1 active:scale-[0.98]"
              onClick={handleCancelAdd}
              disabled={saving}
            >
              {m.common_cancel()}
            </Button>
            <Button
              className="flex-1 active:scale-[0.98]"
              onClick={handleSave}
              disabled={saving}
            >
              {t(STR.save, locale)}
            </Button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {items.length === 0 && !pendingDataUrl && (
        <div className="rounded-2xl bg-plain-surface p-6 shadow-sm text-center">
          <p className="text-muted-foreground">{t(STR.galleryEmpty, locale)}</p>
        </div>
      )}

      {/* Gallery grid */}
      {items.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          {items.map((item) => {
            const confirming = pendingDelete === item.id;
            return (
              <div
                key={item.id}
                className="rounded-2xl bg-plain-surface p-2 shadow-sm flex flex-col gap-2"
                onClick={() => {
                  if (pendingDelete && pendingDelete !== item.id) {
                    setPendingDelete(null);
                  }
                }}
              >
                <img
                  src={item.imageDataUrl}
                  alt={item.caption}
                  className="aspect-square w-full rounded-2xl object-cover"
                />
                {item.caption ? (
                  <p className="truncate px-1 text-sm font-medium text-ink">
                    {item.caption}
                  </p>
                ) : null}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    askKit(item);
                  }}
                  className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-pink-bloom-soft px-3 py-2.5 text-xs font-medium text-ink transition-colors active:scale-[0.98]"
                >
                  <Sparkles className="size-3.5 shrink-0" aria-hidden />
                  {t(STR.askKitWork, locale)}
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(item.id);
                  }}
                  className={
                    "flex w-full items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-xs font-medium transition-colors active:scale-[0.98] " +
                    (confirming
                      ? "bg-destructive text-destructive-foreground"
                      : "bg-muted text-muted-foreground")
                  }
                >
                  <Trash2 className="size-3.5 shrink-0" aria-hidden />
                  {confirming
                    ? t(L.confirmDelete, locale)
                    : t(STR.delete, locale)}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Kit's feedback sheet */}
      {feedbackItem && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4"
          onClick={closeFeedback}
        >
          <div
            className="w-full max-w-md rounded-3xl bg-general-surface p-5 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="type-h3 flex items-center gap-2 text-ink">
                <Sparkles className="size-5 text-pink-bloom" aria-hidden />
                {t(STR.kitFeedbackTitle, locale)}
              </h2>
              <button
                type="button"
                onClick={closeFeedback}
                aria-label={t(STR.close, locale)}
                className="flex size-9 items-center justify-center rounded-full bg-muted text-muted-foreground"
              >
                <X className="size-5" aria-hidden />
              </button>
            </div>

            <img
              src={feedbackItem.imageDataUrl}
              alt={feedbackItem.caption}
              className="mb-4 aspect-video w-full rounded-2xl object-cover"
            />

            {feedbackLoading && (
              <p className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                <Sparkles className="size-4 animate-pulse text-pink-bloom" aria-hidden />
                {m.mentor_thinking()}
              </p>
            )}

            {feedbackError && (
              <p className="rounded-xl bg-yellow-sun-light px-4 py-3 text-sm text-ink">
                {feedbackError === "offline" ? t(STR.aiOffline, locale) : t(STR.aiError, locale)}
              </p>
            )}

            {feedback && (
              <div className="flex flex-col gap-3">
                {feedback.praise && (
                  <FeedbackLine label={t(STR.fbPraise, locale)} text={feedback.praise} tone="bg-green-leaf-light/70" />
                )}
                {feedback.noticed && (
                  <FeedbackLine label={t(STR.fbNoticed, locale)} text={feedback.noticed} tone="bg-blue-ocean-light/50" />
                )}
                {feedback.tryNext && (
                  <FeedbackLine label={t(STR.fbTryNext, locale)} text={feedback.tryNext} tone="bg-yellow-sun-light" />
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function FeedbackLine({ label, text, tone }: { label: string; text: string; tone: string }) {
  return (
    <div className={`rounded-2xl p-3 ${tone}`}>
      <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm text-ink">{text}</p>
    </div>
  );
}
