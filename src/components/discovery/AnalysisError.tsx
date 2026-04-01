"use client";

import { useTranslations } from "next-intl";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AnalysisErrorProps {
  errorType: "ai_failure" | "timeout" | "network";
  onRetry: () => void;
}

/**
 * Error state shown when AI analysis fails.
 * Displays a friendly message with a retry button.
 * Differentiates between AI failure, timeout, and network errors.
 */
export function AnalysisError({ errorType, onRetry }: AnalysisErrorProps) {
  const t = useTranslations("discover.analysis");

  const messageKey =
    errorType === "timeout"
      ? "errorTimeout"
      : errorType === "network"
        ? "errorNetwork"
        : "errorGeneral";

  return (
    <div
      className="flex flex-col items-center gap-4 rounded-xl border border-red-200 bg-red-50 p-6 dark:border-red-800 dark:bg-red-950/20"
      role="alert"
    >
      <AlertCircle className="size-10 text-red-500" />
      <div className="text-center">
        <p className="text-lg font-medium text-red-700 dark:text-red-400">
          {t(messageKey)}
        </p>
        <p className="mt-1 text-sm text-red-600 dark:text-red-500">
          {t("errorHint")}
        </p>
      </div>
      <Button
        onClick={onRetry}
        variant="outline"
        className="border-red-300 text-red-700 hover:bg-red-100 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-950/40"
      >
        <RefreshCw className="mr-2 size-4" />
        {t("retry")}
      </Button>
    </div>
  );
}
