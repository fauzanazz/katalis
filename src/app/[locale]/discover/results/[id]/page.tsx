"use client";

import { useEffect, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Share2,
  Sparkles,
  Clock,
  ImageIcon,
  BookOpen,
  Mic,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import type { Talent } from "@/lib/ai/schemas";

interface DiscoveryResult {
  id: string;
  type: string;
  fileUrl: string | null;
  talents: Talent[];
  createdAt: string;
}

export default function DiscoveryResultsPage() {
  const t = useTranslations("discover.results");
  const params = useParams();
  const discoveryId = params.id as string;

  const [result, setResult] = useState<DiscoveryResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [shareMessage, setShareMessage] = useState<string | null>(null);

  useEffect(() => {
    async function fetchResult() {
      try {
        const res = await fetch(`/api/discovery/${discoveryId}`);
        if (!res.ok) {
          setError(true);
          return;
        }
        const data = await res.json();
        setResult(data);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    }
    fetchResult();
  }, [discoveryId]);

  const handleShare = useCallback(async () => {
    const url = window.location.href;
    const title = t("shareTitle");

    // Try native share first (mobile)
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        // User cancelled or not supported, fall through to clipboard
      }
    }

    // Fallback: copy to clipboard
    try {
      await navigator.clipboard.writeText(url);
      setShareMessage(t("shareCopied"));
      setTimeout(() => setShareMessage(null), 3000);
    } catch {
      setShareMessage(t("shareError"));
      setTimeout(() => setShareMessage(null), 3000);
    }
  }, [t]);

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "artifact":
        return <ImageIcon className="size-4" />;
      case "story":
        return <BookOpen className="size-4" />;
      default:
        return <Mic className="size-4" />;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "artifact":
        return t("artifactType");
      case "story":
        return t("storyType");
      default:
        return t("audioType");
    }
  };

  if (loading) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col items-center justify-center px-4 py-16">
        <div className="size-12 animate-spin rounded-full border-4 border-zinc-200 border-t-blue-500" />
        <p className="mt-4 text-zinc-600 dark:text-zinc-400">{t("loading")}</p>
      </div>
    );
  }

  if (error || !result) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col items-center justify-center px-4 py-16">
        <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
          {t("notFound")}
        </h2>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          {t("notFoundDesc")}
        </p>
        <Link href="/discover">
          <Button variant="outline" className="mt-6">
            <ArrowLeft className="mr-2 size-4" />
            {t("backToDiscover")}
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:py-12">
      {/* Navigation and actions */}
      <div className="mb-6 flex items-center justify-between">
        <Link href="/discover">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-1 size-4" />
            {t("backToDiscover")}
          </Button>
        </Link>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleShare}>
            <Share2 className="mr-1 size-4" />
            {t("share")}
          </Button>
        </div>
      </div>

      {/* Share confirmation message */}
      {shareMessage && (
        <div
          className="mb-4 rounded-lg bg-green-50 p-3 text-center text-sm text-green-700 dark:bg-green-900/20 dark:text-green-400"
          role="status"
          aria-live="polite"
        >
          {shareMessage}
        </div>
      )}

      {/* Header */}
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-gradient-to-r from-blue-100 to-purple-100 dark:from-blue-900/30 dark:to-purple-900/30">
          <Sparkles className="size-8 text-purple-600 dark:text-purple-400" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl dark:text-zinc-50">
          {t("pageTitle")}
        </h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          {t("pageSubtitle")}
        </p>

        {/* Discovery metadata */}
        <div className="mt-4 flex items-center justify-center gap-4 text-sm text-zinc-500 dark:text-zinc-400">
          <span className="flex items-center gap-1">
            {getTypeIcon(result.type)}
            {getTypeLabel(result.type)}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="size-4" />
            {t("dateLabel", {
              date: new Date(result.createdAt).toLocaleDateString(),
            })}
          </span>
        </div>
      </div>

      {/* Talent cards */}
      <div className="flex flex-col gap-4">
        {result.talents.map((talent, index) => (
          <div
            key={`${talent.name}-${index}`}
            className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md dark:border-zinc-700 dark:bg-zinc-900"
            role="article"
            aria-label={t("talentCardLabel", { name: talent.name })}
          >
            {/* Talent name and confidence */}
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                {talent.name}
              </h3>
              <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                {Math.round(talent.confidence * 100)}%
              </span>
            </div>

            {/* Confidence bar */}
            <div
              className="mb-3 h-2 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800"
              role="progressbar"
              aria-valuenow={Math.round(talent.confidence * 100)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={t("confidenceLabel", {
                name: talent.name,
                percent: Math.round(talent.confidence * 100),
              })}
            >
              <div
                className="h-full rounded-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-500"
                style={{ width: `${talent.confidence * 100}%` }}
              />
            </div>

            {/* Reasoning */}
            <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
              {talent.reasoning}
            </p>
          </div>
        ))}
      </div>

      {/* Action buttons */}
      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
        <Link href="/discover">
          <Button size="lg" className="w-full sm:w-auto">
            <Sparkles className="mr-2 size-5" />
            {t("discoverAgain")}
          </Button>
        </Link>
        <Link href="/discover/history">
          <Button variant="outline" size="lg" className="w-full sm:w-auto">
            <Clock className="mr-2 size-5" />
            {t("viewHistory")}
          </Button>
        </Link>
      </div>
    </div>
  );
}
