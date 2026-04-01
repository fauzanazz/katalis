"use client";

import { useState, useCallback, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Sparkles, Loader2, AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "@/i18n/navigation";
import {
  DREAM_MIN_LENGTH,
  DREAM_MAX_LENGTH,
  CONTEXT_MIN_LENGTH,
  CONTEXT_MAX_LENGTH,
} from "@/lib/ai/quest-schemas";

type PageState = "loading" | "no-discovery" | "form" | "generating" | "error";
type ErrorType = "ai_failure" | "timeout" | "network";

interface TalentSummary {
  name: string;
  confidence: number;
  reasoning: string;
}

interface LatestDiscovery {
  id: string;
  talents: TalentSummary[];
}

export default function QuestNewPage() {
  const t = useTranslations("quest.new");
  const router = useRouter();

  const [pageState, setPageState] = useState<PageState>("loading");
  const [errorType, setErrorType] = useState<ErrorType>("ai_failure");

  const [dream, setDream] = useState("");
  const [localContext, setLocalContext] = useState("");
  const [dreamError, setDreamError] = useState("");
  const [contextError, setContextError] = useState("");

  const [latestDiscovery, setLatestDiscovery] =
    useState<LatestDiscovery | null>(null);

  // Fetch latest discovery talents on mount — redirect if none found
  useEffect(() => {
    async function fetchLatestDiscovery() {
      try {
        const res = await fetch("/api/discovery/history?limit=1");
        if (!res.ok) {
          setPageState("no-discovery");
          return;
        }
        const data = await res.json();
        if (data.discoveries && data.discoveries.length > 0) {
          const disc = data.discoveries[0];
          // The history API returns "talents" (already parsed array)
          const talents = Array.isArray(disc.talents) ? disc.talents : [];
          setLatestDiscovery({
            id: disc.id,
            talents,
          });
          setPageState("form");
        } else {
          // No discoveries — block quest creation
          setPageState("no-discovery");
        }
      } catch {
        // Can't determine discovery status — show no-discovery state
        setPageState("no-discovery");
      }
    }
    fetchLatestDiscovery();
  }, []);

  const validateDream = useCallback(
    (value: string): string => {
      if (!value.trim()) return t("validation.dreamEmpty");
      if (value.trim().length < DREAM_MIN_LENGTH)
        return t("validation.dreamTooShort", { min: DREAM_MIN_LENGTH });
      if (value.length > DREAM_MAX_LENGTH)
        return t("validation.dreamTooLong", { max: DREAM_MAX_LENGTH });
      return "";
    },
    [t],
  );

  const validateContext = useCallback(
    (value: string): string => {
      if (!value.trim()) return t("validation.contextEmpty");
      if (value.trim().length < CONTEXT_MIN_LENGTH)
        return t("validation.contextTooShort", { min: CONTEXT_MIN_LENGTH });
      if (value.length > CONTEXT_MAX_LENGTH)
        return t("validation.contextTooLong", { max: CONTEXT_MAX_LENGTH });
      return "";
    },
    [t],
  );

  const handleDreamChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = e.target.value.slice(0, DREAM_MAX_LENGTH);
      setDream(value);
      if (dreamError) setDreamError(validateDream(value));
    },
    [dreamError, validateDream],
  );

  const handleContextChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = e.target.value.slice(0, CONTEXT_MAX_LENGTH);
      setLocalContext(value);
      if (contextError) setContextError(validateContext(value));
    },
    [contextError, validateContext],
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      // Validate both fields
      const dErr = validateDream(dream);
      const cErr = validateContext(localContext);
      setDreamError(dErr);
      setContextError(cErr);

      if (dErr || cErr) return;

      setPageState("generating");

      try {
        const response = await fetch("/api/quest/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            dream: dream.trim(),
            localContext: localContext.trim(),
            talents:
              latestDiscovery?.talents && latestDiscovery.talents.length > 0
                ? latestDiscovery.talents
                : undefined,
            discoveryId: latestDiscovery?.id,
          }),
        });

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          if (response.status === 504 || data.error === "timeout") {
            setErrorType("timeout");
          } else {
            setErrorType("ai_failure");
          }
          setPageState("error");
          return;
        }

        const data = await response.json();
        // Redirect to quest overview
        router.push(`/quest/${data.id}`);
      } catch {
        setErrorType("network");
        setPageState("error");
      }
    },
    [dream, localContext, latestDiscovery, validateDream, validateContext, router],
  );

  const handleRetry = useCallback(() => {
    // Dream and context are preserved — just go back to form state
    setPageState("form");
  }, []);

  // Initial loading state (checking for discovery)
  if (pageState === "loading") {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col items-center px-4 py-16 sm:py-24">
        <div className="flex flex-col items-center gap-6 text-center">
          <div className="flex size-20 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/30">
            <Loader2
              className="size-10 animate-spin text-purple-600 dark:text-purple-400"
              aria-hidden="true"
            />
          </div>
          <p className="text-zinc-600 dark:text-zinc-400">
            {t("title")}...
          </p>
        </div>
      </div>
    );
  }

  // No discovery found — guide user to discover first
  if (pageState === "no-discovery") {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col items-center px-4 py-16 sm:py-24">
        <div className="flex flex-col items-center gap-6 text-center">
          <div className="flex size-20 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
            <Sparkles
              className="size-10 text-amber-600 dark:text-amber-400"
              aria-hidden="true"
            />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
              {t("noDiscovery")}
            </h2>
            <p className="mt-2 text-zinc-600 dark:text-zinc-400">
              {t("noDiscoveryDesc")}
            </p>
          </div>
          <Button
            size="lg"
            onClick={() => router.push("/discover")}
          >
            <Sparkles className="mr-2 size-5" />
            {t("goToDiscovery")}
          </Button>
        </div>
      </div>
    );
  }

  // Quest generation loading state
  if (pageState === "generating") {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col items-center px-4 py-16 sm:py-24">
        <div className="flex flex-col items-center gap-6 text-center">
          <div className="flex size-20 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/30">
            <Loader2
              className="size-10 animate-spin text-purple-600 dark:text-purple-400"
              aria-hidden="true"
            />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
              {t("generating")}
            </h2>
            <p className="mt-2 text-zinc-600 dark:text-zinc-400">
              {t("generatingSubtext")}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (pageState === "error") {
    const errorMessages: Record<ErrorType, string> = {
      ai_failure: t("error.general"),
      timeout: t("error.timeout"),
      network: t("error.network"),
    };

    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col items-center px-4 py-16 sm:py-24">
        <div className="flex flex-col items-center gap-6 text-center">
          <div className="flex size-20 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
            <AlertCircle
              className="size-10 text-red-600 dark:text-red-400"
              aria-hidden="true"
            />
          </div>
          <div>
            <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
              {errorMessages[errorType]}
            </h2>
            <p className="mt-2 text-zinc-600 dark:text-zinc-400">
              {t("error.hint")}
            </p>
          </div>
          <Button onClick={handleRetry} size="lg">
            <RefreshCw className="mr-2 size-5" />
            {t("error.retry")}
          </Button>
        </div>
      </div>
    );
  }

  // Form state
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:py-12">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl dark:text-zinc-50">
          {t("title")}
        </h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          {t("subtitle")}
        </p>
      </div>

      {/* Talent summary from latest discovery */}
      {latestDiscovery && latestDiscovery.talents.length > 0 && (
        <div className="mb-8 rounded-xl border border-purple-200 bg-purple-50 p-4 dark:border-purple-800 dark:bg-purple-900/20">
          <h2 className="mb-3 text-sm font-semibold text-purple-800 dark:text-purple-300">
            {t("talentSummary")}
          </h2>
          <div className="flex flex-wrap gap-2">
            {latestDiscovery.talents.map((talent) => (
              <span
                key={talent.name}
                className="inline-flex items-center rounded-full bg-purple-100 px-3 py-1 text-sm font-medium text-purple-700 dark:bg-purple-900/40 dark:text-purple-300"
              >
                <Sparkles className="mr-1.5 size-3.5" aria-hidden="true" />
                {talent.name}
              </span>
            ))}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-6" noValidate>
        {/* Dream input */}
        <div className="flex flex-col gap-2">
          <label
            htmlFor="dream-input"
            className="text-sm font-semibold text-zinc-800 dark:text-zinc-200"
          >
            {t("dreamLabel")}
          </label>
          <textarea
            id="dream-input"
            value={dream}
            onChange={handleDreamChange}
            placeholder={t("dreamPlaceholder")}
            maxLength={DREAM_MAX_LENGTH}
            rows={3}
            className={`w-full resize-none rounded-lg border bg-white px-4 py-3 text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-purple-500 dark:bg-zinc-900 dark:text-zinc-50 dark:placeholder:text-zinc-600 ${
              dreamError
                ? "border-red-400 focus:ring-red-500"
                : "border-zinc-300 dark:border-zinc-700"
            }`}
            aria-invalid={!!dreamError}
            aria-describedby={
              dreamError ? "dream-error" : "dream-help"
            }
          />
          <div className="flex items-center justify-between text-xs">
            {dreamError ? (
              <p
                id="dream-error"
                className="text-red-600 dark:text-red-400"
                role="alert"
              >
                {dreamError}
              </p>
            ) : (
              <p
                id="dream-help"
                className="text-zinc-500 dark:text-zinc-400"
              >
                {t("dreamHelp")}
              </p>
            )}
            <span
              className={`tabular-nums ${
                dream.length >= DREAM_MAX_LENGTH
                  ? "text-red-600 dark:text-red-400"
                  : "text-zinc-400 dark:text-zinc-500"
              }`}
              aria-label={t("charCount", {
                count: dream.length,
                max: DREAM_MAX_LENGTH,
              })}
            >
              {t("charCount", {
                count: dream.length,
                max: DREAM_MAX_LENGTH,
              })}
            </span>
          </div>
        </div>

        {/* Local context input */}
        <div className="flex flex-col gap-2">
          <label
            htmlFor="context-input"
            className="text-sm font-semibold text-zinc-800 dark:text-zinc-200"
          >
            {t("contextLabel")}
          </label>
          <textarea
            id="context-input"
            value={localContext}
            onChange={handleContextChange}
            placeholder={t("contextPlaceholder")}
            maxLength={CONTEXT_MAX_LENGTH}
            rows={3}
            className={`w-full resize-none rounded-lg border bg-white px-4 py-3 text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-purple-500 dark:bg-zinc-900 dark:text-zinc-50 dark:placeholder:text-zinc-600 ${
              contextError
                ? "border-red-400 focus:ring-red-500"
                : "border-zinc-300 dark:border-zinc-700"
            }`}
            aria-invalid={!!contextError}
            aria-describedby={
              contextError ? "context-error" : "context-help"
            }
          />
          <div className="flex items-center justify-between text-xs">
            {contextError ? (
              <p
                id="context-error"
                className="text-red-600 dark:text-red-400"
                role="alert"
              >
                {contextError}
              </p>
            ) : (
              <p
                id="context-help"
                className="text-zinc-500 dark:text-zinc-400"
              >
                {t("contextHelp")}
              </p>
            )}
            <span
              className={`tabular-nums ${
                localContext.length >= CONTEXT_MAX_LENGTH
                  ? "text-red-600 dark:text-red-400"
                  : "text-zinc-400 dark:text-zinc-500"
              }`}
              aria-label={t("charCount", {
                count: localContext.length,
                max: CONTEXT_MAX_LENGTH,
              })}
            >
              {t("charCount", {
                count: localContext.length,
                max: CONTEXT_MAX_LENGTH,
              })}
            </span>
          </div>
        </div>

        {/* Submit button */}
        <Button
          type="submit"
          size="lg"
          disabled={pageState !== "form"}
          className="w-full"
        >
          <Sparkles className="mr-2 size-5" />
          {t("generateButton")}
        </Button>
      </form>
    </div>
  );
}
