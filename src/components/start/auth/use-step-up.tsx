"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";
import { StepUpDialog } from "@/components/start/auth/StepUpDialog";
import type { Result } from "@/lib/server/result";

interface UseStepUp {
  /**
   * Wrap a step-up-gated server-fn call. If it resolves to
   * `err("step_up_required")`, the dialog opens; once the password is verified
   * the call is retried exactly once. Any other outcome (`ok`, or a different
   * `error`) is returned untouched — branch on `result.ok` / `result.error` as
   * usual. Mirrors the Next `useStepUp` but keys on the `Result` contract rather
   * than an HTTP 403.
   */
  withStepUp: <T>(run: () => Promise<Result<T>>) => Promise<Result<T>>;
  /** Render this in the component tree so the dialog can mount. */
  stepUpDialog: ReactNode;
}

export function useStepUp(): UseStepUp {
  const [open, setOpen] = useState(false);
  const resolversRef = useRef<Array<(verified: boolean) => void>>([]);

  const requestStepUp = useCallback(() => {
    setOpen(true);
    return new Promise<boolean>((resolve) => {
      resolversRef.current.push(resolve);
    });
  }, []);

  // One password verification satisfies every concurrent `withStepUp` waiter.
  const handleResolved = useCallback((verified: boolean) => {
    setOpen(false);
    const pending = resolversRef.current;
    resolversRef.current = [];
    pending.forEach((resolve) => resolve(verified));
  }, []);

  const withStepUp = useCallback(
    async <T,>(run: () => Promise<Result<T>>): Promise<Result<T>> => {
      const res = await run();
      if (res.ok || res.error !== "step_up_required") return res;
      const verified = await requestStepUp();
      if (!verified) return res;
      return run();
    },
    [requestStepUp],
  );

  return {
    withStepUp,
    stepUpDialog: <StepUpDialog open={open} onResolved={handleResolved} />,
  };
}
