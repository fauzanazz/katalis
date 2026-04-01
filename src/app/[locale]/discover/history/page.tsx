"use client";

import { useEffect, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import {
  Sparkles,
  Clock,
  ImageIcon,
  BookOpen,
  Mic,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import type { Talent } from "@/lib/ai/schemas";

interface DiscoveryItem {
  id: string;
  type: string;
  fileUrl: string | null;
  talents: Talent[];
  createdAt: string;
}

interface HistoryResponse {
  discoveries: DiscoveryItem[];
  total: number;
  page: number;
  limit: number;
}

export default function DiscoveryHistoryPage() {
  const t = useTranslations("discover");

  const [discoveries, setDiscoveries] = useState<DiscoveryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const limit = 10;

  const fetchHistory = useCallback(
    async (pageNum: number, append = false) => {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }

      try {
        const res = await fetch(
          `/api/discovery/history?page=${pageNum}&limit=${limit}`,
        );
        if (!res.ok) return;

        const data: HistoryResponse = await res.json();
        if (append) {
          setDiscoveries((prev) => [...prev, ...data.discoveries]);
        } else {
          setDiscoveries(data.discoveries);
        }
        setTotal(data.total);
        setPage(pageNum);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [limit],
  );

  useEffect(() => {
    fetchHistory(1);
  }, [fetchHistory]);

  const handleLoadMore = useCallback(() => {
    fetchHistory(page + 1, true);
  }, [fetchHistory, page]);

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "artifact":
        return <ImageIcon className="size-5 text-blue-500" />;
      case "story":
        return <BookOpen className="size-5 text-purple-500" />;
      default:
        return <Mic className="size-5 text-red-500" />;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "artifact":
        return t("history.artifact");
      case "story":
        return t("history.story");
      default:
        return t("history.audio");
    }
  };

  const hasMore = discoveries.length < total;

  if (loading) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col items-center justify-center px-4 py-16">
        <div className="size-12 animate-spin rounded-full border-4 border-zinc-200 border-t-blue-500" />
        <p className="mt-4 text-zinc-600 dark:text-zinc-400">
          {t("results.loading")}
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:py-12">
      {/* Header */}
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl dark:text-zinc-50">
          {t("history.title")}
        </h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          {t("history.subtitle")}
        </p>
        {total > 0 && (
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {t("history.totalDiscoveries", { count: total })}
          </p>
        )}
      </div>

      {/* Empty state */}
      {discoveries.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-zinc-200 bg-zinc-50 px-6 py-16 text-center dark:border-zinc-700 dark:bg-zinc-900/50">
          <div className="mb-4 flex size-20 items-center justify-center rounded-full bg-gradient-to-r from-blue-100 to-purple-100 dark:from-blue-900/30 dark:to-purple-900/30">
            <Sparkles className="size-10 text-purple-600 dark:text-purple-400" />
          </div>
          <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
            {t("history.empty")}
          </h2>
          <p className="mt-2 max-w-md text-zinc-600 dark:text-zinc-400">
            {t("history.emptyDesc")}
          </p>
          <Link href="/discover">
            <Button size="lg" className="mt-6">
              <Sparkles className="mr-2 size-5" />
              {t("history.startFirst")}
            </Button>
          </Link>
        </div>
      )}

      {/* Discovery list */}
      {discoveries.length > 0 && (
        <div className="flex flex-col gap-4">
          {discoveries.map((discovery) => (
            <Link
              key={discovery.id}
              href={`/discover/results/${discovery.id}`}
            >
              <div
                className="group rounded-xl border border-zinc-200 bg-white p-5 shadow-sm transition-all hover:border-blue-300 hover:shadow-md dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-blue-600"
                role="article"
                aria-label={`${getTypeLabel(discovery.type)} - ${t("history.talentSummary", { count: discovery.talents.length })}`}
              >
                <div className="flex items-start justify-between gap-4">
                  {/* Type icon and info */}
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800">
                      {getTypeIcon(discovery.type)}
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-zinc-900 dark:text-zinc-50">
                        {getTypeLabel(discovery.type)}
                      </h3>
                      <div className="mt-1 flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
                        <Clock className="size-3.5" />
                        <span>
                          {new Date(discovery.createdAt).toLocaleDateString()}
                        </span>
                        <span>·</span>
                        <span>
                          {t("history.talentSummary", {
                            count: discovery.talents.length,
                          })}
                        </span>
                      </div>
                      {/* Talent names summary */}
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {discovery.talents.slice(0, 3).map((talent, i) => (
                          <span
                            key={`${talent.name}-${i}`}
                            className="inline-block rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                          >
                            {talent.name}
                          </span>
                        ))}
                        {discovery.talents.length > 3 && (
                          <span className="inline-block rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                            +{discovery.talents.length - 3}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Arrow */}
                  <ArrowRight className="size-5 shrink-0 text-zinc-400 transition-transform group-hover:translate-x-1 dark:text-zinc-500" />
                </div>
              </div>
            </Link>
          ))}

          {/* Load more button */}
          {hasMore && (
            <div className="mt-4 flex justify-center">
              <Button
                variant="outline"
                onClick={handleLoadMore}
                disabled={loadingMore}
              >
                {loadingMore ? (
                  <>
                    <div className="mr-2 size-4 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600" />
                    {t("history.loadMore")}
                  </>
                ) : (
                  t("history.loadMore")
                )}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Bottom action */}
      {discoveries.length > 0 && (
        <div className="mt-8 flex justify-center">
          <Link href="/discover">
            <Button size="lg">
              <Sparkles className="mr-2 size-5" />
              {t("results.discoverAgain")}
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}
