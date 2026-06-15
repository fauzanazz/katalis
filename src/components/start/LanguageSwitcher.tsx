import { Check, ChevronDown, Globe } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { m } from "@/paraglide/messages";
import {
  baseLocale,
  getLocale,
  locales,
  setLocale,
  type Locale,
} from "@/paraglide/runtime";

// Per-locale display label. Paraglide message fns are individual exports, so a
// static map is needed for dynamic-by-locale dispatch.
const LOCALE_LABEL: Record<Locale, () => string> = {
  en: m.language_en,
  id: m.language_id,
  zh: m.language_zh,
};

export function LanguageSwitcher() {
  const active = getLocale();
  const currentLocale = locales.includes(active) ? active : baseLocale;

  // Paraglide's URL strategy rewrites to the localized URL and persists the
  // cookie; the default full reload keeps SSR locale in sync.
  function handleSwitch(nextLocale: Locale) {
    setLocale(nextLocale);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          aria-label={m.language_switch()}
          className="min-h-[44px] min-w-[44px] gap-1.5"
        >
          <Globe className="size-4" />
          <span className="text-sm font-medium">
            {LOCALE_LABEL[currentLocale]()}
          </span>
          <ChevronDown className="size-4 opacity-70" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="min-w-[12rem]">
        {locales.map((availableLocale) => {
          const isActive = availableLocale === currentLocale;

          return (
            <DropdownMenuItem
              key={availableLocale}
              disabled={isActive}
              onSelect={() => handleSwitch(availableLocale)}
              className="justify-between gap-3"
            >
              <span>{LOCALE_LABEL[availableLocale]()}</span>
              {isActive ? <Check className="size-4 text-primary" /> : null}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
