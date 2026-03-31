"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
  const t = useTranslations("auth");
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    // Client-side validation: empty check
    const trimmedCode = code.trim();
    if (!trimmedCode) {
      setError(t("errors.empty"));
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: trimmedCode }),
      });

      const data = await response.json();

      if (response.ok) {
        router.push("/dashboard");
        router.refresh();
      } else {
        // Map error types to translation keys
        if (data.error === "expired") {
          setError(t("errors.expired"));
        } else if (data.error === "rate_limited") {
          setError(data.message || t("errors.invalid"));
        } else {
          setError(t("errors.invalid"));
        }
      }
    } catch {
      setError(t("errors.invalid"));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      className="flex flex-1 flex-col items-center justify-center bg-zinc-50 px-4 dark:bg-black"
    >
      <div className="w-full max-w-sm">
        <h1 className="mb-8 text-center text-2xl font-bold text-zinc-900 dark:text-zinc-50">
          {t("title")}
        </h1>
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <div>
            <label htmlFor="access-code" className="sr-only">
              {t("title")}
            </label>
            <input
              id="access-code"
              name="code"
              type="text"
              autoComplete="off"
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                if (error) setError(null);
              }}
              placeholder={t("codePlaceholder")}
              aria-invalid={!!error}
              aria-describedby={error ? "code-error" : undefined}
              className="flex h-12 w-full rounded-md border border-zinc-300 bg-white px-4 text-base text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-500/20 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:placeholder:text-zinc-500 dark:focus:border-zinc-400 dark:focus:ring-zinc-400/20"
              disabled={isSubmitting}
            />
          </div>

          {error && (
            <p
              id="code-error"
              role="alert"
              className="text-sm text-red-600 dark:text-red-400"
            >
              {error}
            </p>
          )}

          <Button
            type="submit"
            disabled={isSubmitting}
            className="h-12 w-full text-base"
          >
            {isSubmitting ? "..." : t("submit")}
          </Button>
        </form>
      </div>
    </div>
  );
}
