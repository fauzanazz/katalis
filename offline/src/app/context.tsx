import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Locale } from "@/paraglide/runtime";
import { getStoredLocale, setStoredLocale } from "../i18n";
import { listProfiles } from "../data/store";
import type { Profile } from "../data/types";

const ACTIVE_KEY = "katalis_active_profile";

interface AppContextValue {
  profiles: Profile[];
  /** Active profile, or null when none is selected yet. */
  profile: Profile | null;
  locale: Locale;
  loading: boolean;
  selectProfile: (id: string | null) => void;
  reloadProfiles: () => Promise<void>;
  changeLocale: (locale: Locale) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [activeId, setActiveId] = useState<string | null>(
    typeof localStorage === "undefined" ? null : localStorage.getItem(ACTIVE_KEY),
  );
  const [locale, setLocale] = useState<Locale>(getStoredLocale());
  const [loading, setLoading] = useState(true);

  const reloadProfiles = useCallback(async () => {
    setProfiles(await listProfiles());
  }, []);

  useEffect(() => {
    reloadProfiles().finally(() => setLoading(false));
  }, [reloadProfiles]);

  const selectProfile = useCallback((id: string | null) => {
    setActiveId(id);
    if (id) localStorage.setItem(ACTIVE_KEY, id);
    else localStorage.removeItem(ACTIVE_KEY);
  }, []);

  const changeLocale = useCallback((next: Locale) => {
    setStoredLocale(next);
    setLocale(next);
  }, []);

  const profile = useMemo(
    () => profiles.find((p) => p.id === activeId) ?? null,
    [profiles, activeId],
  );

  // Keep the app locale in sync with the active profile's saved language.
  useEffect(() => {
    if (profile && profile.locale !== locale) changeLocale(profile.locale);
  }, [profile, locale, changeLocale]);

  const value = useMemo<AppContextValue>(
    () => ({ profiles, profile, locale, loading, selectProfile, reloadProfiles, changeLocale }),
    [profiles, profile, locale, loading, selectProfile, reloadProfiles, changeLocale],
  );

  return <AppContext value={value}>{children}</AppContext>;
}

export function useApp(): AppContextValue {
  const ctx = use(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
