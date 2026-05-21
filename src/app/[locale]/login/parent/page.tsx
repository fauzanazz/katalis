"use client";

import { useState, type FormEvent, Suspense } from "react";
import { useTranslations } from "next-intl";
import { useRouter, Link } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { ParentFeatureCarousel } from "@/components/auth/ParentFeatureCarousel";

function ParentLoginPageContent() {
  const t = useTranslations("auth.parent");
  const tFeatures = useTranslations("auth.parent.features");
  const tRegister = useTranslations("auth.register");
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl");
  const safeCallback = callbackUrl?.startsWith("/") ? callbackUrl : "/parent";

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
        router.push(safeCallback);
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
    <div className="flex flex-1">
      {/* Left: Form */}
      <div className="flex w-full flex-col justify-center px-8 py-12 lg:w-1/2 xl:px-16">
        <div className="mx-auto w-full max-w-sm">
          <Link
            href="/login"
            className="mb-8 inline-flex items-center gap-2 text-sm text-zinc-500 transition-colors hover:text-ink"
          >
            <ArrowLeft className="size-4" aria-hidden />
            {t("back")}
          </Link>

          <div className="mb-8">
            <h1 className="text-2xl font-bold text-ink">{t("title")}</h1>
            <p className="mt-1 text-sm text-zinc-500">{tFeatures("heading")}</p>
          </div>

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
                className="flex h-12 w-full rounded-md border border-border bg-white px-4 text-base text-ink placeholder:text-zinc-400 focus:border-green-leaf-deep focus:outline-none focus:ring-2 focus:ring-green-leaf-deep/20 disabled:cursor-not-allowed disabled:opacity-50"
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
                className="flex h-12 w-full rounded-md border border-border bg-white px-4 text-base text-ink placeholder:text-zinc-400 focus:border-green-leaf-deep focus:outline-none focus:ring-2 focus:ring-green-leaf-deep/20 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={isSubmitting}
              />
            </div>

            {error && (
              <p id="auth-error" role="alert" className="text-sm text-red-600">
                {error}
              </p>
            )}

            <Button
              type="submit"
              disabled={isSubmitting}
              className="h-12 w-full bg-ink text-base hover:bg-zinc-800"
            >
              {isSubmitting ? "..." : t("submit")}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-zinc-500">
            {tRegister("noAccount")}{" "}
            <Link
              href="/register"
              className="font-medium text-ink underline underline-offset-4 hover:text-zinc-700"
            >
              {tRegister("registerLink")}
            </Link>
          </p>
        </div>
      </div>

      {/* Right: Visual panel */}
      <div className="relative hidden min-h-[600px] overflow-hidden lg:block lg:min-h-[calc(100dvh-4.5rem)] lg:w-1/2">
        <ParentFeatureCarousel />
      </div>
    </div>
  );
}

export default function ParentLoginPage() {
  return (
    <Suspense>
      <ParentLoginPageContent />
    </Suspense>
  );
}
