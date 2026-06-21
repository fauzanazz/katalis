import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Plus, Trash2 } from "lucide-react";
import type { Locale } from "@/paraglide/runtime";
import { Button } from "@/components/ui/button";
import { useApp } from "../app/context";
import { createProfile, deleteProfile } from "../data/store";
import { t } from "../data/types";
import { STR } from "../strings";

const AVATARS = ["🦊", "🐰", "🐯", "🐨", "🦉", "🐙", "🦕", "🐧", "🦁", "🐢"];
const LANGUAGES: Array<{ code: Locale; label: string }> = [
  { code: "id", label: "Bahasa Indonesia" },
  { code: "en", label: "English" },
  { code: "zh", label: "中文" },
];

export function Profiles() {
  const { profiles, locale, selectProfile, reloadProfiles, changeLocale } = useApp();
  const navigate = useNavigate();
  const [creating, setCreating] = useState(profiles.length === 0);
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState(AVATARS[0]);
  const [lang, setLang] = useState<Locale>(locale);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  async function open(id: string) {
    selectProfile(id);
    navigate({ to: "/" });
  }

  async function create() {
    const trimmed = name.trim();
    if (!trimmed) return;
    const profile = await createProfile(trimmed, emoji, lang);
    await reloadProfiles();
    changeLocale(lang);
    selectProfile(profile.id);
    navigate({ to: "/" });
  }

  async function remove(id: string) {
    await deleteProfile(id);
    await reloadProfiles();
    setPendingDelete(null);
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <h1 className="type-h2 pt-4 text-center text-ink">{t(STR.whoPlaying, locale)}</h1>

      {!creating && (
        <ul className="flex flex-col gap-3">
          {profiles.map((p) => (
            <li key={p.id} className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => open(p.id)}
                className="flex flex-1 items-center gap-4 rounded-2xl bg-plain-surface p-4 text-left shadow-sm transition-transform active:scale-[0.98]"
              >
                <span className="text-3xl" aria-hidden>{p.emoji}</span>
                <span className="text-lg font-semibold text-ink">{p.name}</span>
              </button>
              {pendingDelete === p.id ? (
                <Button variant="destructive" size="sm" onClick={() => remove(p.id)}>
                  {t(STR.delete, locale)}
                </Button>
              ) : (
                <button
                  type="button"
                  onClick={() => setPendingDelete(p.id)}
                  className="flex size-11 items-center justify-center rounded-full text-muted-foreground"
                  aria-label={t(STR.deleteProfile, locale)}
                >
                  <Trash2 className="size-5" aria-hidden />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {creating ? (
        <div className="flex flex-col gap-5 rounded-3xl bg-plain-surface p-5 shadow-sm">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t(STR.yourName, locale)}
            maxLength={20}
            className="rounded-xl border border-border bg-input px-4 py-3 text-lg text-ink outline-none focus:ring-2 focus:ring-ring"
          />

          <div>
            <p className="mb-2 text-sm font-medium text-muted-foreground">{t(STR.pickAvatar, locale)}</p>
            <div className="flex flex-wrap gap-2">
              {AVATARS.map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => setEmoji(a)}
                  className={`flex size-12 items-center justify-center rounded-full text-2xl transition ${
                    emoji === a ? "bg-primary/15 ring-2 ring-primary" : "bg-muted"
                  }`}
                  aria-pressed={emoji === a}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-muted-foreground">{t(STR.pickLanguage, locale)}</p>
            <div className="flex flex-col gap-2">
              {LANGUAGES.map((l) => (
                <button
                  key={l.code}
                  type="button"
                  onClick={() => setLang(l.code)}
                  className={`rounded-xl px-4 py-3 text-left font-medium transition ${
                    lang === l.code ? "bg-primary text-primary-foreground" : "bg-muted text-ink"
                  }`}
                  aria-pressed={lang === l.code}
                >
                  {l.label}
                </button>
              ))}
            </div>
          </div>

          <Button size="lg" disabled={!name.trim()} onClick={create}>
            {t(STR.letsGo, locale)}
          </Button>
          {profiles.length > 0 && (
            <button
              type="button"
              onClick={() => setCreating(false)}
              className="text-sm text-muted-foreground underline"
            >
              {t(STR.whoPlaying, locale)}
            </button>
          )}
        </div>
      ) : (
        <Button variant="secondary" size="lg" onClick={() => setCreating(true)}>
          <Plus className="size-5" aria-hidden /> {t(STR.newExplorer, locale)}
        </Button>
      )}
    </div>
  );
}
