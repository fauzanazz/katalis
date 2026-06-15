import { useState, useCallback, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Sparkles, Loader2, AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocaleRouter } from "@/i18n/start-navigation";
import { KidPageShell } from "@/components/layout/KidPageShell";
import { m } from "@/paraglide/messages";
import {
  DREAM_MIN_LENGTH,
  DREAM_MAX_LENGTH,
  CONTEXT_MIN_LENGTH,
  CONTEXT_MAX_LENGTH,
} from "@/lib/ai/quest-schemas";
import { getDiscoveryHistoryFn } from "@/lib/server/discovery";
import { generateQuestFn } from "@/lib/server/quest";

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

export const Route = createFileRoute("/$locale/quest/new/")({
  component: QuestNewPage,
});

function QuestNewPage() {
  const router = useLocaleRouter();

  const [pageState, setPageState] = useState<PageState>("loading");
  const [errorType, setErrorType] = useState<ErrorType>("ai_failure");

  const [dream, setDream] = useState("");
  const [localContext, setLocalContext] = useState("");
  const [dreamError, setDreamError] = useState("");
  const [contextError, setContextError] = useState("");

  const [latestDiscovery, setLatestDiscovery] =
    useState<LatestDiscovery | null>(null);

  // Fetch latest discovery talents on mount — fall back to guest_talents if unauthenticated
  useEffect(() => {
    async function fetchLatestDiscovery() {
      try {
        const res = await getDiscoveryHistoryFn({ data: { page: 1, limit: 1 } });

        if (!res.ok) {
          // Unauthenticated or error — check for guest session data
          const raw = sessionStorage.getItem("guest_talents");
          if (raw) {
            const parsed = JSON.parse(raw) as TalentSummary[];
            setLatestDiscovery({ id: "guest", talents: parsed });
            setPageState("form");
          } else {
            setPageState("no-discovery");
          }
          return;
        }

        if (res.discoveries && res.discoveries.length > 0) {
          const disc = res.discoveries[0];
          const talents = Array.isArray(disc.talents) ? disc.talents : [];
          setLatestDiscovery({
            id: disc.id,
            talents: talents as TalentSummary[],
          });
          setPageState("form");
        } else {
          // No discoveries — check for guest session data
          const raw = sessionStorage.getItem("guest_talents");
          if (raw) {
            const parsed = JSON.parse(raw) as TalentSummary[];
            setLatestDiscovery({ id: "guest", talents: parsed });
            setPageState("form");
          } else {
            setPageState("no-discovery");
          }
        }
      } catch {
        // Can't determine discovery status — check guest session data
        const raw = sessionStorage.getItem("guest_talents");
        if (raw) {
          try {
            const parsed = JSON.parse(raw) as TalentSummary[];
            setLatestDiscovery({ id: "guest", talents: parsed });
            setPageState("form");
          } catch {
            setPageState("no-discovery");
          }
        } else {
          setPageState("no-discovery");
        }
      }
    }
    fetchLatestDiscovery();
  }, []);

  const validateDream = useCallback((value: string): string => {
    if (!value.trim()) return m.quest_new_validation_dreamEmpty();
    if (value.trim().length < DREAM_MIN_LENGTH)
      return m.quest_new_validation_dreamTooShort({ min: DREAM_MIN_LENGTH });
    if (value.length > DREAM_MAX_LENGTH)
      return m.quest_new_validation_dreamTooLong({ max: DREAM_MAX_LENGTH });
    return "";
  }, []);

  const validateContext = useCallback((value: string): string => {
    if (!value.trim()) return m.quest_new_validation_contextEmpty();
    if (value.trim().length < CONTEXT_MIN_LENGTH)
      return m.quest_new_validation_contextTooShort({ min: CONTEXT_MIN_LENGTH });
    if (value.length > CONTEXT_MAX_LENGTH)
      return m.quest_new_validation_contextTooLong({ max: CONTEXT_MAX_LENGTH });
    return "";
  }, []);

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

      const dErr = validateDream(dream);
      const cErr = validateContext(localContext);
      setDreamError(dErr);
      setContextError(cErr);

      if (dErr || cErr) return;

      setPageState("generating");

      try {
        const guestDob =
          typeof window !== "undefined"
            ? sessionStorage.getItem("guest_dob")
            : null;

        const res = await generateQuestFn({
          data: {
            dream: dream.trim(),
            localContext: localContext.trim(),
            talents:
              latestDiscovery?.talents && latestDiscovery.talents.length > 0
                ? latestDiscovery.talents
                : undefined,
            discoveryId: latestDiscovery?.id,
            ...(guestDob ? { guestDob } : {}),
          },
        });

        if (!res.ok) {
          const code = res.error;
          if (code === "timeout") {
            setErrorType("timeout");
          } else {
            setErrorType("ai_failure");
          }
          setPageState("error");
          return;
        }

        // content_blocked is an ok() response with error field — treat as ai_failure
        if ("error" in res && res.error === "content_blocked") {
          setErrorType("ai_failure");
          setPageState("error");
          return;
        }

        // Guest path: store preview in sessionStorage and go to preview page
        if ("guest" in res && res.guest === true) {
          sessionStorage.setItem(
            "guest_quest",
            JSON.stringify({
              dream: dream.trim(),
              localContext: localContext.trim(),
              missions: res.missions,
            }),
          );
          router.push("/quest/preview");
          return;
        }

        // Authenticated path: redirect to quest overview
        router.push(`/quest/${"id" in res ? res.id : ""}`);
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

  const errorMessages: Record<ErrorType, string> = {
    ai_failure: m.quest_new_error_general(),
    timeout: m.quest_new_error_timeout(),
    network: m.quest_new_error_network(),
  };

  return (
    <KidPageShell
      kicker={m.quest_new_kicker()}
      title={m.quest_new_title()}
      subtitle={m.quest_new_subtitle()}
    >
      {/* Loading state */}
      {pageState === "loading" && (
        <div className="flex flex-col items-center gap-6 py-16 text-center">
          <div className="flex size-20 items-center justify-center rounded-full bg-black/10">
            <Loader2 className="size-10 animate-spin text-black/60" aria-hidden="true" />
          </div>
          <p className="font-semibold text-black/60">{m.quest_new_title()}...</p>
        </div>
      )}

      {/* No discovery state */}
      {pageState === "no-discovery" && (
        <div className="flex flex-col items-center gap-6 py-16 text-center">
          <div className="flex size-20 items-center justify-center rounded-full bg-black/10">
            <Sparkles className="size-10 text-black/60" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-black">{m.quest_new_noDiscovery()}</h2>
            <p className="mt-2 font-semibold text-black/60">{m.quest_new_noDiscoveryDesc()}</p>
          </div>
          <Button
            size="lg"
            className="rounded-full border-2 border-black bg-black font-black text-white shadow-[3px_3px_0_#000] hover:bg-black/80"
            onClick={() => router.push("/discover")}
          >
            <Sparkles className="mr-2 size-5" />
            {m.quest_new_goToDiscovery()}
          </Button>
        </div>
      )}

      {/* Generating state */}
      {pageState === "generating" && (
        <div className="flex flex-col items-center gap-6 py-16 text-center">
          <div className="flex size-20 items-center justify-center rounded-full bg-black/10">
            <Loader2 className="size-10 animate-spin text-black/60" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-black">{m.quest_new_generating()}</h2>
            <p className="mt-2 font-semibold text-black/60">{m.quest_new_generatingSubtext()}</p>
          </div>
        </div>
      )}

      {/* Error state */}
      {pageState === "error" && (
        <div className="flex flex-col items-center gap-6 py-16 text-center">
          <div className="flex size-20 items-center justify-center rounded-full bg-red-100">
            <AlertCircle className="size-10 text-red-600" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-xl font-black text-black">{errorMessages[errorType]}</h2>
            <p className="mt-2 font-semibold text-black/60">{m.quest_new_error_hint()}</p>
          </div>
          <Button
            onClick={handleRetry}
            size="lg"
            className="rounded-full border-2 border-black bg-black font-black text-white shadow-[3px_3px_0_#000] hover:bg-black/80"
          >
            <RefreshCw className="mr-2 size-5" />
            {m.quest_new_error_retry()}
          </Button>
        </div>
      )}

      {/* Form state */}
      {pageState === "form" && (
        <div className="mx-auto w-full max-w-2xl">
          {/* Talent summary from latest discovery */}
          {latestDiscovery && latestDiscovery.talents.length > 0 && (
            <div className="mb-6 rounded-xl border-2 border-black bg-white p-4 shadow-[3px_3px_0_#000]">
              <h2 className="mb-3 text-sm font-black uppercase tracking-widest text-black">
                {m.quest_new_talentSummary()}
              </h2>
              <div className="flex flex-wrap gap-2">
                {latestDiscovery.talents.map((talent) => (
                  <span
                    key={talent.name}
                    className="inline-flex items-center rounded-full border-2 border-black bg-[#C8A4E0] px-3 py-1 text-sm font-black text-black"
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
              <label htmlFor="dream-input" className="text-sm font-black uppercase tracking-widest text-black">
                {m.quest_new_dreamLabel()}
              </label>
              <textarea
                id="dream-input"
                value={dream}
                onChange={handleDreamChange}
                placeholder={m.quest_new_dreamPlaceholder()}
                maxLength={DREAM_MAX_LENGTH}
                rows={3}
                className={`w-full resize-none rounded-lg border-2 bg-white px-4 py-3 font-semibold text-zinc-900 placeholder:font-normal placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-black ${
                  dreamError ? "border-red-500 focus:ring-red-500" : "border-black"
                }`}
                aria-invalid={!!dreamError}
                aria-describedby={dreamError ? "dream-error" : "dream-help"}
              />
              <div className="flex items-center justify-between text-xs">
                {dreamError ? (
                  <p id="dream-error" className="font-semibold text-red-600" role="alert">
                    {dreamError}
                  </p>
                ) : (
                  <p id="dream-help" className="text-black/50">{m.quest_new_dreamHelp()}</p>
                )}
                <span
                  className={`tabular-nums font-semibold ${dream.length >= DREAM_MAX_LENGTH ? "text-red-600" : "text-black/40"}`}
                  aria-label={m.quest_new_charCount({ count: dream.length, max: DREAM_MAX_LENGTH })}
                >
                  {m.quest_new_charCount({ count: dream.length, max: DREAM_MAX_LENGTH })}
                </span>
              </div>
            </div>

            {/* Local context input */}
            <div className="flex flex-col gap-2">
              <label htmlFor="context-input" className="text-sm font-black uppercase tracking-widest text-black">
                {m.quest_new_contextLabel()}
              </label>
              <textarea
                id="context-input"
                value={localContext}
                onChange={handleContextChange}
                placeholder={m.quest_new_contextPlaceholder()}
                maxLength={CONTEXT_MAX_LENGTH}
                rows={3}
                className={`w-full resize-none rounded-lg border-2 bg-white px-4 py-3 font-semibold text-zinc-900 placeholder:font-normal placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-black ${
                  contextError ? "border-red-500 focus:ring-red-500" : "border-black"
                }`}
                aria-invalid={!!contextError}
                aria-describedby={contextError ? "context-error" : "context-help"}
              />
              <div className="flex items-center justify-between text-xs">
                {contextError ? (
                  <p id="context-error" className="font-semibold text-red-600" role="alert">
                    {contextError}
                  </p>
                ) : (
                  <p id="context-help" className="text-black/50">{m.quest_new_contextHelp()}</p>
                )}
                <span
                  className={`tabular-nums font-semibold ${localContext.length >= CONTEXT_MAX_LENGTH ? "text-red-600" : "text-black/40"}`}
                  aria-label={m.quest_new_charCount({ count: localContext.length, max: CONTEXT_MAX_LENGTH })}
                >
                  {m.quest_new_charCount({ count: localContext.length, max: CONTEXT_MAX_LENGTH })}
                </span>
              </div>
            </div>

            {/* Submit button */}
            <Button
              type="submit"
              size="lg"
              className="w-full rounded-full border-2 border-black bg-black font-black text-white shadow-[3px_3px_0_#000] hover:bg-black/80 active:shadow-[1px_1px_0_#000]"
            >
              <Sparkles className="mr-2 size-5" />
              {m.quest_new_generateButton()}
            </Button>
          </form>
        </div>
      )}
    </KidPageShell>
  );
}
