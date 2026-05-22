import type { ReactNode } from "react";
import { Rocket, Sparkles } from "lucide-react";

interface KidPageShellProps {
  kicker: string;
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}

export function KidPageShell({
  kicker,
  title,
  subtitle,
  actions,
  children,
}: KidPageShellProps) {
  return (
    <section className="relative flex-1 overflow-hidden bg-[#F5C542] px-6 py-10">
      <div
        className="pointer-events-none absolute right-6 top-6 h-14 w-14 rotate-12 rounded-sm bg-[#C8A4E0]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute bottom-8 left-6 h-10 w-10 -rotate-6 rounded-sm bg-[#A8C8F0]"
        aria-hidden
      />

      <div className="relative z-10 mx-auto w-full max-w-6xl">
        <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <div className="mb-4 flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-black px-3.5 py-1.5 text-xs font-black uppercase tracking-widest text-white">
                <Sparkles className="size-3" aria-hidden />
                {kicker}
              </span>
              <Rocket className="size-5 text-black/60" aria-hidden />
            </div>
            <h1 className="text-4xl font-black leading-[1.05] tracking-tight text-black sm:text-5xl">
              {title}
            </h1>
            {subtitle ? (
              <p className="mt-2 text-base font-semibold text-black/65 sm:text-lg">
                {subtitle}
              </p>
            ) : null}
          </div>
          {actions ? <div className="shrink-0">{actions}</div> : null}
        </header>

        {children}
      </div>
    </section>
  );
}
