"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { useRouter, Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";

export default function ParentLoginPage() {
  const t = useTranslations("auth.parent");
  const tRegister = useTranslations("auth.register");
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password) {
      setError(t("errors.required"));
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const data = await response.json();

      if (response.ok) {
        router.push("/parent");
        router.refresh();
      } else {
        if (data.error === "rate_limited") {
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
    <div className="flex flex-1 flex-col items-center justify-center bg-background px-4 py-10 sm:py-14">
      <div className="w-full max-w-sm">
        <Link
          href="/login"
          className="mb-6 inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-ink"
        >
          <span aria-hidden="true">←</span> {t("back")}
        </Link>

        <h1 className="mb-8 text-2xl font-bold text-ink">{t("title")}</h1>

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium text-ink">
              {t("emailLabel")}
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (error) setError(null);
              }}
              placeholder={t("emailPlaceholder")}
              className="flex h-12 w-full rounded-md border border-border bg-white px-4 text-base text-ink placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-500/20 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={isSubmitting}
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium text-ink">
              {t("passwordLabel")}
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (error) setError(null);
              }}
              placeholder={t("passwordPlaceholder")}
              className="flex h-12 w-full rounded-md border border-border bg-white px-4 text-base text-ink placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-500/20 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={isSubmitting}
            />
          </div>

          {error && (
            <p id="auth-error" role="alert" className="text-sm text-red-600">
              {error}
            </p>
          )}

          <Button type="submit" disabled={isSubmitting} className="h-12 w-full text-base">
            {isSubmitting ? "..." : t("submit")}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-zinc-500">
          {tRegister("noAccount")}{" "}
          <Link
            href="/register"
            className="text-ink underline underline-offset-4 hover:text-zinc-700"
          >
            {tRegister("registerLink")}
          </Link>
        </p>
      </div>
    </div>
  );
}
