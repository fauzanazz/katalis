import { ImagePlus, RefreshCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LocaleLink } from "@/i18n/start-navigation";
import { m } from "@/paraglide/messages";

interface AnalysisErrorProps {
  errorType: "ai_failure" | "timeout" | "network" | "content_blocked" | "guest_limit_reached";
  onRetry: () => void;
  onResetUpload?: () => void;
}

const errorMessages: Record<
  Exclude<AnalysisErrorProps["errorType"], "guest_limit_reached">,
  () => string
> = {
  timeout: m.discover_analysis_errorTimeout,
  network: m.discover_analysis_errorNetwork,
  content_blocked: m.discover_analysis_errorContentBlocked,
  ai_failure: m.discover_analysis_errorGeneral,
};

export function AnalysisError({ errorType, onRetry, onResetUpload }: AnalysisErrorProps) {
  if (errorType === "guest_limit_reached") {
    return (
      <div
        className="flex flex-col items-center gap-5 rounded-2xl bg-yellow-sun/10 px-6 py-12 text-center"
        role="alert"
      >
        <div className="flex size-14 items-center justify-center rounded-full bg-yellow-sun/20">
          <Sparkles className="size-7 text-yellow-sun-deep" />
        </div>
        <div>
          <p className="text-lg font-bold text-ink">{m.discover_analysis_errorGuestLimit()}</p>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {m.discover_analysis_errorGuestLimitHint()}
          </p>
        </div>
        <LocaleLink href="/register">
          <Button className="bg-yellow-sun-deep font-bold text-white hover:bg-yellow-sun">
            {m.discover_analysis_loginCta()}
          </Button>
        </LocaleLink>
      </div>
    );
  }

  const message = errorMessages[errorType];

  return (
    <div
      className="flex flex-col items-center gap-5 rounded-2xl bg-muted px-6 py-12 text-center"
      role="alert"
    >
      <svg
        width="52"
        height="52"
        viewBox="0 0 52 52"
        fill="none"
        aria-hidden="true"
        className="text-muted-foreground opacity-60"
      >
        <circle cx="26" cy="26" r="23" stroke="currentColor" strokeWidth="2" />
        <circle cx="19" cy="22" r="2.5" fill="currentColor" />
        <circle cx="33" cy="22" r="2.5" fill="currentColor" />
        <path
          d="M18 35 Q26 29 34 35"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </svg>

      <div>
        <p className="text-lg font-bold text-ink">{message()}</p>
        <p className="mt-1.5 text-sm text-muted-foreground">{m.discover_analysis_errorHint()}</p>
      </div>

      <div className="flex w-full flex-col justify-center gap-3 sm:w-auto sm:flex-row">
        <Button
          onClick={onRetry}
          className="bg-yellow-sun-deep font-bold text-white hover:bg-yellow-sun"
        >
          <RefreshCw className="mr-2 size-4" />
          {m.discover_analysis_retry()}
        </Button>
        {onResetUpload && (
          <Button onClick={onResetUpload} variant="outline" className="font-bold">
            <ImagePlus className="mr-2 size-4" />
            {m.discover_analysis_uploadNewImage()}
          </Button>
        )}
      </div>
    </div>
  );
}
