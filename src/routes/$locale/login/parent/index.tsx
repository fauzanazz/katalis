import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { LocaleLink, useLocaleRouter } from "@/i18n/start-navigation";
import { loginParentFn, migrateGuestFn } from "@/lib/server/auth";
import { ParentFeatureCarousel } from "@/components/start/auth/ParentFeatureCarousel";
import { m } from "@/paraglide/messages";

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------

interface SearchParams {
  callbackUrl?: string;
}

export const Route = createFileRoute("/$locale/login/parent/")({
  validateSearch: (s): SearchParams => ({
    callbackUrl: typeof s.callbackUrl === "string" ? s.callbackUrl : undefined,
  }),
  component: ParentLoginPage,
});

// ---------------------------------------------------------------------------
// Guest snapshot helpers (run client-side, post-login)
// ---------------------------------------------------------------------------

interface GuestSnapshot {
  childName: string | undefined;
  childDob: string | undefined;
  history: unknown[] | undefined;
  quest: unknown | undefined;
}

function readGuestSnapshot(): GuestSnapshot | null {
  const childDob = sessionStorage.getItem("guest_dob") ?? undefined;
  const rawHistory = localStorage.getItem("katalis_guest_history");
  const history = rawHistory ? (JSON.parse(rawHistory) as unknown[]) : undefined;
  const hasData = childDob || (history && history.length > 0);
  if (!hasData) return null;
  return {
    childName: sessionStorage.getItem("guest_name") ?? undefined,
    childDob,
    history,
    quest: (() => {
      const raw = sessionStorage.getItem("guest_quest");
      return raw ? JSON.parse(raw) : undefined;
    })(),
  };
}

function clearGuestStorage() {
  sessionStorage.removeItem("guest_name");
  sessionStorage.removeItem("guest_dob");
  sessionStorage.removeItem("guest_talents");
  sessionStorage.removeItem("guest_quest");
  localStorage.removeItem("katalis_guest_history");
  localStorage.removeItem("katalis_guest_id");
}

// ---------------------------------------------------------------------------
// GuestMigrationModal — hardcoded Indonesian strings preserved verbatim
// (latent '<strong>' literal rendering bug intentionally carried over)
// ---------------------------------------------------------------------------

function GuestMigrationModal({
  snapshot,
  onSave,
  onSkip,
  isSaving,
}: {
  snapshot: GuestSnapshot;
  onSave: () => void;
  onSkip: () => void;
  isSaving: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm rounded-lg border border-border bg-white p-6 shadow-xl">
        <h2 className="mb-2 text-lg font-bold text-ink">Simpan sesi discovery?</h2>
        <p className="mb-4 text-sm text-zinc-500">
          Sesi analisis bakat{snapshot.childName ? ` untuk <strong>${snapshot.childName}</strong>` : ""} dari sebelum
          login ditemukan. Simpan sebagai profil anak baru?
        </p>
        <div className="flex gap-3">
          <Button onClick={onSave} disabled={isSaving} className="flex-1 bg-ink text-sm hover:bg-zinc-800">
            {isSaving ? "Menyimpan..." : "Simpan"}
          </Button>
          <Button
            onClick={onSkip}
            disabled={isSaving}
            variant="outline"
            className="flex-1 text-sm"
          >
            Lewati
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

function ParentLoginPage() {
  const { callbackUrl } = Route.useSearch() as SearchParams;
  // Open-redirect guard: only allow same-origin paths
  const safeCallback = callbackUrl?.startsWith("/") ? callbackUrl : "/parent";

  const router = useLocaleRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [guestSnapshot, setGuestSnapshot] = useState<GuestSnapshot | null>(null);
  const [isSavingGuest, setIsSavingGuest] = useState(false);

  // Defensively strip any credentials that a pre-hydration native form submit
  // may have serialized into the URL (?email=…&password=…) — they must never
  // linger in the address bar, history, or referrer headers.
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.has("email") || url.searchParams.has("password")) {
      url.searchParams.delete("email");
      url.searchParams.delete("password");
      window.history.replaceState(null, "", url.pathname + url.search);
    }
  }, []);

  function redirectAfterLogin() {
    router.push(safeCallback);
    router.refresh();
  }

  async function handleSaveGuest() {
    if (!guestSnapshot) return;
    setIsSavingGuest(true);
    try {
      await migrateGuestFn({ data: guestSnapshot });
    } catch {
      // best-effort: never block redirect on migration failure
    }
    setGuestSnapshot(null);
    redirectAfterLogin();
  }

  function handleSkipGuest() {
    clearGuestStorage();
    setGuestSnapshot(null);
    redirectAfterLogin();
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password) {
      setError(m.auth_parent_errors_required());
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await loginParentFn({ data: { email: email.trim(), password } });

      if (result.ok) {
        const snapshot = readGuestSnapshot();
        if (snapshot) {
          setGuestSnapshot(snapshot);
        } else {
          redirectAfterLogin();
        }
      } else {
        if (result.error === "rate_limited") {
          setError(result.message ?? m.auth_parent_errors_invalid());
        } else {
          setError(m.auth_parent_errors_invalid());
        }
      }
    } catch {
      setError(m.auth_parent_errors_invalid());
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex flex-1">
      {guestSnapshot && (
        <GuestMigrationModal
          snapshot={guestSnapshot}
          onSave={handleSaveGuest}
          onSkip={handleSkipGuest}
          isSaving={isSavingGuest}
        />
      )}

      {/* Left: Form */}
      <div className="flex w-full flex-col justify-center px-8 py-12 lg:w-1/2 xl:px-16">
        <div className="mx-auto w-full max-w-sm">
          <LocaleLink
            href="/"
            className="mb-8 inline-flex items-center gap-2 text-sm text-zinc-500 transition-colors hover:text-ink"
          >
            <ArrowLeft className="size-4" aria-hidden />
            {m.auth_parent_back()}
          </LocaleLink>

          <div className="mb-8">
            <h1 className="text-2xl font-bold text-ink">{m.auth_parent_title()}</h1>
            <p className="mt-1 text-sm text-zinc-500">{m.auth_parent_features_heading()}</p>
          </div>

          <form method="post" onSubmit={handleSubmit} noValidate className="space-y-4">
            <div>
              <label htmlFor="email" className="mb-1 block text-sm font-medium text-ink">
                {m.auth_parent_emailLabel()}
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
                placeholder={m.auth_parent_emailPlaceholder()}
                className="flex h-12 w-full rounded-md border border-border bg-white px-4 text-base text-ink placeholder:text-zinc-400 focus:border-green-leaf-deep focus:outline-none focus:ring-2 focus:ring-green-leaf-deep/20 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={isSubmitting}
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-1 block text-sm font-medium text-ink">
                {m.auth_parent_passwordLabel()}
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError(null);
                }}
                placeholder={m.auth_parent_passwordPlaceholder()}
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
              {isSubmitting ? "..." : m.auth_parent_submit()}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-zinc-500">
            {m.auth_register_noAccount()}{" "}
            <LocaleLink
              href="/register"
              className="font-medium text-ink underline underline-offset-4 hover:text-zinc-700"
            >
              {m.auth_register_registerLink()}
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
