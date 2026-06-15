import { useState, useEffect, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { m } from "@/paraglide/messages";
import { LocaleLink, useLocaleRouter } from "@/i18n/start-navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { ParentFeatureCarousel } from "@/components/start/auth/ParentFeatureCarousel";
import { registerFn, migrateGuestFn } from "@/lib/server/auth";

export const Route = createFileRoute("/$locale/register/")({
  component: RegisterPage,
});

function RegisterPage() {
  const router = useLocaleRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Strip any credentials a pre-hydration native form submit may have placed in
  // the URL — they must never linger in the address bar, history, or referrer.
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.has("email") || url.searchParams.has("password")) {
      url.searchParams.delete("email");
      url.searchParams.delete("password");
      window.history.replaceState(null, "", url.pathname + url.search);
    }
  }, []);

  async function migrateGuestData() {
    try {
      const childName = sessionStorage.getItem("guest_name") ?? undefined;
      const childDob = sessionStorage.getItem("guest_dob") ?? undefined;
      const rawHistory = localStorage.getItem("katalis_guest_history");
      const rawQuest = sessionStorage.getItem("guest_quest");

      const history = rawHistory ? JSON.parse(rawHistory) : undefined;
      const quest = rawQuest ? JSON.parse(rawQuest) : undefined;

      const hasData = childDob || (history && history.length > 0) || quest;
      if (!hasData) return;

      await migrateGuestFn({ data: { childName, childDob, history, quest } });

      // Clear guest storage regardless of outcome
      sessionStorage.removeItem("guest_name");
      sessionStorage.removeItem("guest_dob");
      sessionStorage.removeItem("guest_talents");
      sessionStorage.removeItem("guest_quest");
      localStorage.removeItem("katalis_guest_history");
      localStorage.removeItem("katalis_guest_id");
    } catch {
      // Best-effort — don't block registration redirect
    }
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (!name.trim() || !email.trim() || !password.trim()) {
      setError(m.auth_register_errors_required());
      return;
    }

    if (password.length < 8) {
      setError(m.auth_register_errors_passwordTooShort());
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await registerFn({
        data: { name: name.trim(), email: email.trim(), password },
      });

      if (result.ok) {
        await migrateGuestData();
        router.push("/parent");
        router.refresh();
      } else {
        if (result.error === "email_exists") {
          setError(m.auth_register_errors_emailExists());
        } else if (result.error === "rate_limited" || result.error === "validation") {
          setError(result.message ?? m.auth_register_errors_general());
        } else {
          setError(m.auth_register_errors_general());
        }
      }
    } catch {
      setError(m.auth_register_errors_general());
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex flex-1">
      {/* Left: Form */}
      <div className="flex w-full flex-col justify-center px-8 py-12 lg:w-1/2 xl:px-16">
        <div className="mx-auto w-full max-w-sm">
          <LocaleLink
            href="/login"
            className="mb-8 inline-flex items-center gap-2 text-sm text-zinc-500 transition-colors hover:text-ink"
          >
            <ArrowLeft className="size-4" aria-hidden />
            {m.auth_parent_back()}
          </LocaleLink>

          <div className="mb-8">
            <h1 className="text-2xl font-bold text-ink">{m.auth_register_title()}</h1>
            <p className="mt-1 text-sm text-zinc-500">{m.auth_parent_features_heading()}</p>
          </div>

          <form method="post" onSubmit={handleSubmit} noValidate className="space-y-4">
            <div>
              <label htmlFor="name" className="mb-1 block text-sm font-medium text-ink">
                {m.auth_register_nameLabel()}
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
                placeholder={m.auth_register_namePlaceholder()}
                className="flex h-12 w-full rounded-md border border-border bg-white px-4 text-base text-ink placeholder:text-zinc-400 focus:border-green-leaf-deep focus:outline-none focus:ring-2 focus:ring-green-leaf-deep/20 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={isSubmitting}
              />
            </div>

            <div>
              <label htmlFor="email" className="mb-1 block text-sm font-medium text-ink">
                {m.auth_register_emailLabel()}
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (error) setError(null);
                }}
                placeholder={m.auth_register_emailPlaceholder()}
                className="flex h-12 w-full rounded-md border border-border bg-white px-4 text-base text-ink placeholder:text-zinc-400 focus:border-green-leaf-deep focus:outline-none focus:ring-2 focus:ring-green-leaf-deep/20 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={isSubmitting}
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-1 block text-sm font-medium text-ink">
                {m.auth_register_passwordLabel()}
              </label>
              <input
                id="password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError(null);
                }}
                placeholder={m.auth_register_passwordPlaceholder()}
                className="flex h-12 w-full rounded-md border border-border bg-white px-4 text-base text-ink placeholder:text-zinc-400 focus:border-green-leaf-deep focus:outline-none focus:ring-2 focus:ring-green-leaf-deep/20 disabled:cursor-not-allowed disabled:opacity-50"
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
              className="h-12 w-full bg-ink text-base hover:bg-zinc-800"
            >
              {isSubmitting ? "..." : m.auth_register_submit()}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-zinc-500">
            {m.auth_register_hasAccount()}{" "}
            <LocaleLink
              href="/login"
              className="font-medium text-ink underline underline-offset-4 hover:text-zinc-700"
            >
              {m.auth_register_loginLink()}
            </LocaleLink>
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
