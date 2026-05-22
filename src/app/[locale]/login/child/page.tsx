"use client";

import { useState, type FormEvent, Suspense } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useRouter, Link } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { ArrowRight, Sparkles, Rocket, HelpCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

function ChildLoginPageContent() {
  const t = useTranslations("auth");
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl");
  const safeCallback = callbackUrl?.startsWith("/") ? callbackUrl : "/discover";

  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showNoCodeDialog, setShowNoCodeDialog] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const trimmedCode = code.trim();
    if (!trimmedCode) {
      setError(t("child.errors.empty"));
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
        router.push(safeCallback);
        router.refresh();
      } else {
        if (data.error === "expired") {
          setError(t("child.errors.expired"));
        } else if (data.error === "rate_limited") {
          setError(data.message || t("child.errors.invalid"));
        } else {
          setError(t("child.errors.invalid"));
        }
      }
    } catch {
      setError(t("child.errors.invalid"));
    } finally {
      setIsSubmitting(false);
    }
  }

  const features = [
    t("choose.childSignal1"),
    t("choose.childSignal2"),
    t("choose.childSignal3"),
  ];

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#F5C542] flex items-center justify-center px-6 py-10">
      {/* Corner decorations */}
      <div className="pointer-events-none absolute right-4 top-4 h-14 w-14 rotate-12 rounded-sm bg-[#C8A4E0]" />
      <div className="pointer-events-none absolute bottom-6 left-4 h-10 w-10 -rotate-6 rounded-sm bg-[#A8C8F0]" />

      <div className="w-full max-w-2xl">
        <Link
          href="/login"
          className="mb-8 inline-flex items-center gap-1 text-sm font-semibold text-black/50 hover:text-black"
        >
          ← {t("child.back")}
        </Link>

        <div className="grid grid-cols-1 items-center gap-10 md:grid-cols-2">
          {/* Left: text + form */}
          <div>
            {/* KID ZONE badge */}
            <div className="mb-5 flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-black px-3.5 py-1.5 text-xs font-black tracking-widest text-white uppercase">
                <Sparkles className="size-3" aria-hidden />
                {t("choose.childKicker")}
              </span>
              <Rocket className="size-5 text-black/60" aria-hidden />
            </div>

            {/* Heading */}
            <h1 className="mb-2 text-5xl font-black leading-[1.05] tracking-tight text-black sm:text-6xl">
              {t("choose.childTitle")}
            </h1>
            <p className="mb-6 text-base font-semibold text-black/65">
              {t("choose.childDesc")}
            </p>

            {/* Feature chips */}
            <div className="mb-7 flex flex-wrap gap-2">
              {features.map((feat) => (
                <span
                  key={feat}
                  className="rounded border-2 border-black bg-white px-4 py-2 text-sm font-bold text-black shadow-[2px_2px_0_#000]"
                >
                  {feat}
                </span>
              ))}
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} noValidate className="space-y-3">
              <label htmlFor="access-code" className="sr-only">
                {t("child.codePlaceholder")}
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
                placeholder={t("child.codePlaceholder")}
                aria-invalid={!!error}
                className="flex h-14 w-full rounded-2xl border-2 border-black bg-white px-5 text-center text-lg font-bold tracking-[0.25em] text-black placeholder:text-black/30 placeholder:tracking-normal placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-black/20 disabled:opacity-50"
                disabled={isSubmitting}
              />

              {error && (
                <p role="alert" className="text-sm font-semibold text-red-700">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="flex h-14 w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-[#D4A0D0] px-6 text-base font-bold text-white shadow-[3px_3px_0_rgba(0,0,0,0.25)] transition-all hover:brightness-95 active:shadow-[1px_1px_0_rgba(0,0,0,0.25)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? (
                  "..."
                ) : (
                  <>
                    {t("choose.childCta")}
                    <ArrowRight className="size-5" aria-hidden />
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setShowNoCodeDialog(true)}
                className="flex w-full items-center justify-center gap-1.5 pt-1 text-sm font-semibold text-black/50 hover:text-black"
              >
                <HelpCircle className="size-4" aria-hidden />
                {t("child.noCode")}
              </button>
            </form>
          </div>

          {/* Right: mascot in polaroid */}
          <div className="relative flex justify-center">
            {/* Purple accent behind frame */}
            <div className="absolute -right-2 -top-2 h-10 w-10 rounded-sm bg-[#C8A4E0] rotate-6" />

            {/* Polaroid frame */}
            <div className="relative z-10 rotate-2 border border-black/10 bg-white p-3 pb-8 shadow-2xl">
              <Image
                src="/images/kit-mascot.webp"
                alt="Kit the Explorer Fox"
                width={256}
                height={256}
                className="h-56 w-56 object-contain sm:h-64 sm:w-64"
                priority
              />
            </div>
          </div>
        </div>
      </div>

      <Dialog open={showNoCodeDialog} onOpenChange={setShowNoCodeDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-xl font-black">
              {t("child.noCodeDialog.title")}
            </DialogTitle>
          </DialogHeader>

          <ol className="mt-2 space-y-4">
            {([1, 2, 3] as const).map((step) => (
              <li key={step} className="flex gap-3">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#F5C542] text-sm font-black text-black">
                  {step}
                </span>
                <div>
                  <p className="font-bold text-sm text-foreground">
                    {t(`child.noCodeDialog.step${step}Title`)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {t(`child.noCodeDialog.step${step}Desc`)}
                  </p>
                </div>
              </li>
            ))}
          </ol>

          <div className="mt-4 flex flex-col gap-2">
            <Link
              href="/login/parent"
              className="flex h-11 items-center justify-center rounded-full bg-black px-6 text-sm font-bold text-white hover:bg-black/80"
              onClick={() => setShowNoCodeDialog(false)}
            >
              {t("child.noCodeDialog.parentLoginCta")}
            </Link>
            <button
              type="button"
              onClick={() => setShowNoCodeDialog(false)}
              className="h-11 rounded-full border-2 border-black/20 text-sm font-semibold text-black/60 hover:border-black/40 hover:text-black"
            >
              {t("child.noCodeDialog.close")}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function ChildLoginPage() {
  return (
    <Suspense>
      <ChildLoginPageContent />
    </Suspense>
  );
}
