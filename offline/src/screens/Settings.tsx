import { useState } from "react";
import { Database, Loader2, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useApp } from "../app/context";
import { t } from "../data/types";
import { STR } from "../strings";
import { shareAppData } from "../data/export";

type ShareState = "idle" | "preparing" | "done" | "empty" | "error";

export function Settings() {
  const { locale } = useApp();
  const [state, setState] = useState<ShareState>("idle");

  async function onShare() {
    if (state === "preparing") return;
    setState("preparing");
    try {
      const result = await shareAppData();
      setState(result === "empty" ? "empty" : result === "canceled" ? "idle" : "done");
    } catch {
      setState("error");
    }
  }

  return (
    <div className="flex flex-col gap-5 p-5">
      <header className="pt-2">
        <h1 className="type-h2 text-ink">{t(STR.settingsTitle, locale)}</h1>
        <p className="text-muted-foreground">{t(STR.settingsSubtitle, locale)}</p>
      </header>

      <div className="flex flex-col gap-3 rounded-3xl bg-plain-surface p-5 shadow-sm">
        <span className="flex size-12 items-center justify-center rounded-2xl bg-blue-ocean-light text-blue-ocean-deep">
          <Database className="size-6" aria-hidden />
        </span>
        <h2 className="text-lg font-bold text-ink">{t(STR.shareData, locale)}</h2>
        <p className="text-sm text-muted-foreground">{t(STR.shareDataHint, locale)}</p>
        <p className="text-xs text-muted-foreground">{t(STR.shareIncludes, locale)}</p>

        <Button onClick={onShare} disabled={state === "preparing"} className="active:scale-[0.98]">
          {state === "preparing" ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden /> {t(STR.sharePreparing, locale)}
            </>
          ) : (
            <>
              <Share2 className="size-4" aria-hidden /> {t(STR.shareData, locale)}
            </>
          )}
        </Button>

        {state === "done" && (
          <p className="rounded-xl bg-green-leaf-light px-4 py-2 text-sm text-ink">
            {t(STR.shareDone, locale)}
          </p>
        )}
        {state === "empty" && (
          <p className="rounded-xl bg-yellow-sun-light px-4 py-2 text-sm text-ink">
            {t(STR.shareEmpty, locale)}
          </p>
        )}
        {state === "error" && (
          <p className="rounded-xl bg-yellow-sun-light px-4 py-2 text-sm text-ink">
            {t(STR.shareError, locale)}
          </p>
        )}
      </div>
    </div>
  );
}
