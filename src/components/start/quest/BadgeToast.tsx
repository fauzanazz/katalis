import { m } from "@/paraglide/messages";
import { useEffect, useState } from "react";
import { Sparkles, X } from "lucide-react";
import type { EarnedBadge } from "@/lib/badges";
import { badgeName, badgeDescription } from "@/components/start/quest/badge-labels";

interface BadgeToastProps {
  badges: EarnedBadge[];
  onClose: () => void;
}

export function BadgeToast({ badges, onClose }: BadgeToastProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  // Auto-advance through multiple badges
  useEffect(() => {
    if (badges.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentIndex((prev) => {
        if (prev >= badges.length - 1) {
          clearInterval(timer);
          return prev;
        }
        return prev + 1;
      });
    }, 3000);
    return () => clearInterval(timer);
  }, [badges.length]);

  // Auto-dismiss after 5 seconds
  useEffect(() => {
    const timer = setTimeout(onClose, 5000);
    return () => clearTimeout(timer);
  }, [onClose]);

  if (badges.length === 0) return null;

  const badge = badges[currentIndex];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      role="alert"
      aria-live="assertive"
    >
      <div className="relative mx-4 max-w-sm rounded-2xl bg-white p-6 text-center shadow-2xl">
        <button
          onClick={onClose}
          className="absolute right-3 top-3 rounded-full p-1 text-muted-foreground hover:bg-muted"
          aria-label={m.badges_close()}
        >
          <X className="size-4" />
        </button>

        <div className="mb-3 flex items-center justify-center gap-1 text-amber-500">
          <Sparkles className="size-5" aria-hidden="true" />
          <span className="text-sm font-semibold">{m.badges_newBadge()}</span>
          <Sparkles className="size-5" aria-hidden="true" />
        </div>

        <div className="mb-3 text-5xl" aria-hidden="true">
          {badge.icon}
        </div>

        <h3 className="mb-1 text-lg font-bold text-foreground">
          {badgeName(badge.slug)}
        </h3>
        <p className="text-sm text-muted-foreground">
          {badgeDescription(badge.slug)}
        </p>

        {badges.length > 1 && (
          <p className="mt-3 text-xs text-muted-foreground">
            {currentIndex + 1} / {badges.length}
          </p>
        )}
      </div>
    </div>
  );
}
