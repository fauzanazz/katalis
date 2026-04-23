"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { useRouter, Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";

export default function ChildLoginPage() {
  const t = useTranslations("auth.child");
  const router = useRouter();

  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

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
        router.push("/discover");
        router.refresh();
      } else {
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
    <div className="flex min-h-[calc(100vh-4rem)] flex-col bg-gradient-to-b from-amber-50 to-orange-100 px-6 py-8">
      <Link
        href="/login"
        className="mb-4 inline-flex items-center gap-1 text-base text-amber-700 hover:text-amber-900"
      >
        <span aria-hidden="true">←</span> {t("back")}
      </Link>

      <div className="flex flex-1 flex-col items-center justify-center">
        {/* Kit the Explorer Fox mascot */}
        <div className="mb-8 flex justify-center">
          <img
            src="/images/kit-mascot.png"
            alt="Kit the Explorer Fox"
            className="h-48 w-48 object-contain sm:h-56 sm:w-56 md:h-64 md:w-64"
          />
        </div>

        <h1 className="mb-3 text-center text-4xl font-bold text-amber-900 sm:text-5xl">{t("title")}</h1>
        <p className="mb-10 text-center text-lg text-amber-700 sm:text-xl">{t("subtitle")}</p>

        <form onSubmit={handleSubmit} noValidate className="w-full max-w-md space-y-6">
          <div>
            <label htmlFor="access-code" className="sr-only">
              {t("codePlaceholder")}
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
              className="flex h-16 w-full rounded-2xl border-3 border-amber-300 bg-white px-6 text-center text-xl font-bold tracking-[0.3em] text-ink placeholder:text-amber-300 placeholder:tracking-normal placeholder:font-normal focus:border-amber-500 focus:outline-none focus:ring-4 focus:ring-amber-400/30 disabled:cursor-not-allowed disabled:opacity-50 sm:h-20 sm:text-2xl"
              disabled={isSubmitting}
            />
          </div>

          {error && (
            <p id="auth-error" role="alert" className="text-center text-base text-red-600">
              {error}
            </p>
          )}

          <Button
            type="submit"
            disabled={isSubmitting}
            className="h-16 w-full rounded-2xl bg-amber-500 text-xl font-bold text-white shadow-lg shadow-amber-500/30 hover:bg-amber-600 hover:shadow-xl hover:shadow-amber-500/40 disabled:opacity-50 sm:h-20 sm:text-2xl"
          >
            {isSubmitting ? "..." : t("submit")}
          </Button>
        </form>
      </div>
    </div>
  );
}
