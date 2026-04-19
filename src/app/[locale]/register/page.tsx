"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function RegisterPage() {
  const t = useTranslations("auth");
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (!name.trim() || !email.trim() || !password.trim()) {
      setError(t("register.errors.required"));
      return;
    }

    if (password.length < 8) {
      setError(t("register.errors.passwordTooShort"));
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          password,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        router.push("/dashboard");
        router.refresh();
      } else {
        if (data.error === "email_exists") {
          setError(t("register.errors.emailExists"));
        } else if (data.error === "rate_limited") {
          setError(data.message || t("register.errors.general"));
        } else {
          setError(data.message || t("register.errors.general"));
        }
      }
    } catch {
      setError(t("register.errors.general"));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-background px-4 py-10 sm:py-14">
      <div className="w-full max-w-sm">
        <h1 className="mb-8 text-center text-2xl font-bold text-ink">
          {t("register.title")}
        </h1>
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <div>
            <label htmlFor="name" className="mb-1 block text-sm font-medium text-ink">
              {t("register.nameLabel")}
            </label>
            <input
              id="name"
              name="name"
              type="text"
              autoComplete="name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError(null);
              }}
              placeholder={t("register.namePlaceholder")}
              className="flex h-12 w-full rounded-md border border-border bg-white px-4 text-base text-ink placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-500/20 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={isSubmitting}
            />
          </div>

          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium text-ink">
              {t("register.emailLabel")}
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
              placeholder={t("register.emailPlaceholder")}
              className="flex h-12 w-full rounded-md border border-border bg-white px-4 text-base text-ink placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-500/20 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={isSubmitting}
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium text-ink">
              {t("register.passwordLabel")}
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (error) setError(null);
              }}
              placeholder={t("register.passwordPlaceholder")}
              className="flex h-12 w-full rounded-md border border-border bg-white px-4 text-base text-ink placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-500/20 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={isSubmitting}
            />
          </div>

          {error && (
            <p id="register-error" role="alert" className="text-sm text-red-600">
              {error}
            </p>
          )}

          <Button
            type="submit"
            disabled={isSubmitting}
            className="h-12 w-full text-base"
          >
            {isSubmitting ? "..." : t("register.submit")}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-zinc-500">
          {t("register.hasAccount")}{" "}
          <Link href="/login" className="text-ink underline underline-offset-4 hover:text-zinc-700">
            {t("register.loginLink")}
          </Link>
        </p>
      </div>
    </div>
  );
}
