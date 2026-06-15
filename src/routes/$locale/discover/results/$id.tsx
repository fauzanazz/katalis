import { createElement, useState, useCallback } from "react";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { motion } from "motion/react";
import {
  ArrowLeft,
  Share2,
  Clock,
  ImageIcon,
  BookOpen,
  Mic,
  Music,
  Palette,
  PenLine,
  FlaskConical,
  Leaf,
  Cpu,
  Crown,
  Heart,
  Zap,
  Trophy,
  Gem,
  Shapes,
  Compass,
  RefreshCw,
  Rocket,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { LocaleLink } from "@/i18n/start-navigation";
import { m } from "@/paraglide/messages";
import { getDiscoveryByIdFn } from "@/lib/server/discovery";
import type { Talent } from "@/lib/ai/schemas";

export const Route = createFileRoute("/$locale/discover/results/$id")({
  loader: async ({ params }) => {
    const result = await getDiscoveryByIdFn({ data: { id: params.id } });
    if (!result.ok) {
      if (result.error === "not_found") throw notFound();
      // forbidden / unauthorized — also treat as not found for the client
      throw notFound();
    }
    return {
      discovery: {
        id: result.id,
        type: result.type,
        fileUrl: result.fileUrl,
        talents: result.talents,
        createdAt: result.createdAt,
      },
    };
  },
  component: DiscoveryResultsPage,
});

const PALETTE = [
  { bg: "#fffbeb", border: "#fde68a", accent: "#d97706", iconBg: "#fef3c7", text: "#78350f" },
  { bg: "#eff6ff", border: "#bfdbfe", accent: "#2563eb", iconBg: "#dbeafe", text: "#1e3a8a" },
  { bg: "#f0fdf4", border: "#bbf7d0", accent: "#16a34a", iconBg: "#dcfce7", text: "#14532d" },
  { bg: "#fdf4ff", border: "#e9d5ff", accent: "#9333ea", iconBg: "#f3e8ff", text: "#581c87" },
  { bg: "#fff1f2", border: "#fecdd3", accent: "#e11d48", iconBg: "#ffe4e6", text: "#881337" },
] as const;

type PaletteEntry = (typeof PALETTE)[number];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getTalentIcon(name: string): React.ComponentType<any> {
  const n = name.toLowerCase();
  if (/music|song|sing|melody|rhythm|sound/.test(n)) return Music;
  if (/art|draw|paint|visual|sketch|craft|design/.test(n)) return Palette;
  if (/writ|story|poet|narrat|essay/.test(n)) return PenLine;
  if (/science|math|logic|analyt|research|experiment/.test(n)) return FlaskConical;
  if (/nature|plant|animal|environ|outdoor|garden/.test(n)) return Leaf;
  if (/tech|code|computer|program|digital/.test(n)) return Cpu;
  if (/lead|teach|coach|mentor|organiz/.test(n)) return Crown;
  if (/empathy|care|help|kind|social|communicat/.test(n)) return Heart;
  if (/sport|athlet|danc|move|physical/.test(n)) return Zap;
  if (/creat|imagin|invent|innovat/.test(n)) return Shapes;
  if (/perform|act|theat/.test(n)) return Trophy;
  return Gem;
}

function getTalentLevel(confidence: number): { label: string; style: { bg: string; text: string } } {
  if (confidence >= 0.85)
    return { label: m.discover_results_naturalGift(), style: { bg: "#fef3c7", text: "#92400e" } };
  if (confidence >= 0.70)
    return { label: m.discover_results_strongTalent(), style: { bg: "#dbeafe", text: "#1e3a8a" } };
  if (confidence >= 0.55)
    return { label: m.discover_results_genuineInterest(), style: { bg: "#dcfce7", text: "#14532d" } };
  return { label: m.discover_results_emergingSkill(), style: { bg: "#f3e8ff", text: "#581c87" } };
}

// Gentle floating background decorations — fixed positions, no hydration mismatch
const DOT_CONFIGS = [
  { x: 6, y: 12, size: 10, color: "#fbbf24", delay: 0, dur: 4 },
  { x: 87, y: 7, size: 7, color: "#60a5fa", delay: 0.6, dur: 3.5 },
  { x: 4, y: 62, size: 6, color: "#34d399", delay: 1.1, dur: 4.5 },
  { x: 91, y: 53, size: 8, color: "#c084fc", delay: 0.3, dur: 3.8 },
  { x: 50, y: 3, size: 9, color: "#fb7185", delay: 0.9, dur: 4.2 },
  { x: 22, y: 82, size: 5, color: "#fbbf24", delay: 1.4, dur: 3.6 },
  { x: 74, y: 77, size: 7, color: "#60a5fa", delay: 0.7, dur: 4.1 },
  { x: 38, y: 28, size: 4, color: "#34d399", delay: 1.6, dur: 3.9 },
];

function FloatingDots() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {DOT_CONFIGS.map((dot, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            left: `${dot.x}%`,
            top: `${dot.y}%`,
            width: dot.size,
            height: dot.size,
            backgroundColor: dot.color,
            opacity: 0.35,
          }}
          animate={{ y: [-5, 5, -5], opacity: [0.25, 0.5, 0.25] }}
          transition={{
            duration: dot.dur,
            delay: dot.delay,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}

function ChampionCard({
  talent,
  palette,
}: {
  talent: Talent;
  palette: PaletteEntry;
}) {
  const iconComponent = getTalentIcon(talent.name);
  const level = getTalentLevel(talent.confidence);
  const pct = Math.round(talent.confidence * 100);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
      className="relative overflow-hidden rounded-3xl p-6 sm:p-8"
      style={{ backgroundColor: palette.bg, border: `1.5px solid ${palette.border}` }}
      role="article"
      aria-label={m.discover_results_talentCardLabel({ name: talent.name })}
    >
      <div
        className="absolute -bottom-6 -right-6 size-28 rounded-full opacity-15"
        style={{ backgroundColor: palette.accent }}
        aria-hidden="true"
      />
      <div
        className="absolute -top-4 -left-4 size-16 rounded-full opacity-10"
        style={{ backgroundColor: palette.accent }}
        aria-hidden="true"
      />

      <div
        className="absolute right-5 top-5 flex size-10 items-center justify-center rounded-full text-base font-black text-white shadow-sm sm:size-12 sm:text-lg"
        style={{ backgroundColor: palette.accent }}
        aria-label="Rank 1"
      >
        1
      </div>

      <div
        className="mb-5 flex size-14 items-center justify-center rounded-2xl sm:size-16"
        style={{ backgroundColor: palette.iconBg }}
      >
        {createElement(iconComponent, { size: 28, color: palette.accent, strokeWidth: 1.75 })}
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2 pr-12">
        <h2 className="text-2xl font-black tracking-tight text-ink sm:text-3xl">
          {talent.name}
        </h2>
        <span
          className="shrink-0 rounded-full px-3 py-0.5 text-xs font-bold"
          style={{ backgroundColor: level.style.bg, color: level.style.text }}
        >
          {level.label}
        </span>
      </div>

      <div className="mb-5 flex items-center gap-3">
        <div
          className="relative h-3 flex-1 overflow-hidden rounded-full"
          style={{ backgroundColor: `${palette.accent}20` }}
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${talent.name}: ${pct}%`}
        >
          <motion.div
            className="absolute inset-y-0 left-0 rounded-full"
            style={{ backgroundColor: palette.accent }}
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 1.3, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
          />
        </div>
        <span
          className="text-2xl font-black tabular-nums"
          style={{ color: palette.accent }}
        >
          {pct}%
        </span>
      </div>

      <p className="text-sm leading-relaxed" style={{ color: palette.text }}>
        {talent.reasoning}
      </p>
    </motion.div>
  );
}

function TalentCard({
  talent,
  palette,
  rank,
  delay,
}: {
  talent: Talent;
  palette: PaletteEntry;
  rank: number;
  delay: number;
}) {
  const iconComponent = getTalentIcon(talent.name);
  const pct = Math.round(talent.confidence * 100);

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay, ease: [0.16, 1, 0.3, 1] }}
      className="relative overflow-hidden rounded-2xl p-4 sm:p-5"
      style={{ backgroundColor: palette.bg, border: `1.5px solid ${palette.border}` }}
      role="article"
      aria-label={m.discover_results_talentCardLabel({ name: talent.name })}
    >
      <div className="mb-3 flex items-center gap-2">
        <span
          className="flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-black text-white"
          style={{ backgroundColor: palette.accent }}
        >
          {rank}
        </span>
        {createElement(iconComponent, { size: 15, color: palette.accent, strokeWidth: 2 })}
        <h3 className="line-clamp-1 flex-1 text-sm font-bold text-ink">
          {talent.name}
        </h3>
        <span
          className="shrink-0 text-sm font-black tabular-nums"
          style={{ color: palette.accent }}
        >
          {pct}%
        </span>
      </div>

      <div
        className="mb-3 h-1.5 overflow-hidden rounded-full"
        style={{ backgroundColor: `${palette.accent}20` }}
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${talent.name}: ${pct}%`}
      >
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: palette.accent }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 1, delay: delay + 0.35, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>

      <p className="line-clamp-2 text-xs leading-relaxed" style={{ color: palette.text }}>
        {talent.reasoning}
      </p>
    </motion.div>
  );
}

function getTypeLabel(type: string): string {
  switch (type) {
    case "artifact": return m.discover_results_artifactType();
    case "story":    return m.discover_results_storyType();
    default:         return m.discover_results_audioType();
  }
}

function getTypeIcon(type: string) {
  switch (type) {
    case "artifact": return createElement(ImageIcon, { className: "size-4" });
    case "story":    return createElement(BookOpen, { className: "size-4" });
    default:         return createElement(Mic, { className: "size-4" });
  }
}

function DiscoveryResultsPage() {
  const { discovery } = Route.useLoaderData();
  const [shareMessage, setShareMessage] = useState<string | null>(null);

  const handleShare = useCallback(async () => {
    const url = window.location.href;
    const title = m.discover_results_shareTitle();
    if (typeof navigator !== "undefined" && navigator.share) {
      try { await navigator.share({ title, url }); return; } catch { /* fall through */ }
    }
    try {
      await navigator.clipboard.writeText(url);
      setShareMessage(m.discover_results_shareCopied());
    } catch {
      setShareMessage(m.discover_results_shareError());
    }
    setTimeout(() => setShareMessage(null), 3000);
  }, []);

  const [champion, ...rest] = discovery.talents;
  const topTalentName = champion?.name ?? "";

  return (
    <div className="relative mx-auto w-full max-w-2xl px-4 py-8 sm:py-12">
      <FloatingDots />

      {/* Top nav */}
      <div className="relative mb-6 flex items-center justify-between">
        <LocaleLink href="/discover">
          <Button variant="ghost" size="sm">
            {createElement(ArrowLeft, { className: "mr-1 size-4" })}
            {m.discover_results_backToDiscover()}
          </Button>
        </LocaleLink>
        <Button variant="outline" size="sm" onClick={handleShare}>
          {createElement(Share2, { className: "mr-1 size-4" })}
          {m.discover_results_share()}
        </Button>
      </div>

      {shareMessage && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="relative mb-4 rounded-xl bg-green-50 p-3 text-center text-sm text-green-700"
          role="status"
          aria-live="polite"
        >
          {shareMessage}
        </motion.div>
      )}

      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="relative mb-8 text-center"
      >
        <motion.div
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.1, type: "spring", stiffness: 200, damping: 18 }}
          className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-amber-100"
        >
          {createElement(Compass, { className: "size-8 text-amber-600" })}
        </motion.div>

        <h1 className="text-3xl font-black tracking-tight text-ink sm:text-4xl">
          {m.discover_results_pageTitle()}
        </h1>
        <p className="mt-2 text-muted-foreground">{m.discover_results_pageSubtitle()}</p>

        <div className="mt-4 flex items-center justify-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5 rounded-full bg-stone-100 px-3 py-1">
            {getTypeIcon(discovery.type)}
            {getTypeLabel(discovery.type)}
          </span>
          <span className="flex items-center gap-1.5 rounded-full bg-stone-100 px-3 py-1">
            {createElement(Clock, { className: "size-3.5" })}
            {m.discover_results_dateLabel({ date: new Date(discovery.createdAt).toLocaleDateString() })}
          </span>
        </div>
      </motion.div>

      {champion && (
        <div className="mb-4">
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.25 }}
            className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground"
          >
            {m.discover_results_topTalent()}
          </motion.p>
          <ChampionCard talent={champion} palette={PALETTE[0]} />
        </div>
      )}

      {rest.length > 0 && (
        <div className="mb-6 mt-6">
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground"
          >
            {m.discover_results_moreTalents()}
          </motion.p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {rest.map((talent, idx) => (
              <TalentCard
                key={`${talent.name}-${idx}`}
                talent={talent}
                palette={PALETTE[(idx + 1) % PALETTE.length]}
                rank={idx + 2}
                delay={0.55 + idx * 0.1}
              />
            ))}
          </div>
        </div>
      )}

      {champion && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="mt-8 overflow-hidden rounded-3xl bg-amber-50 p-6 sm:p-8"
          style={{ border: "1.5px solid #fde68a" }}
        >
          <div className="flex items-start gap-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-amber-100">
              {createElement(Rocket, { size: 22, color: "#d97706", strokeWidth: 1.75 })}
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-black text-ink">{m.discover_results_readyForQuest()}</h3>
              <p className="mt-1 text-sm text-amber-800">
                {m.discover_results_questDesc({ talent: topTalentName })}
              </p>
            </div>
          </div>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <LocaleLink href="/quest" className="flex-1 sm:flex-none">
              <Button size="lg" className="w-full sm:w-auto">
                {createElement(Rocket, { className: "mr-2 size-4" })}
                {m.discover_results_startQuest()}
              </Button>
            </LocaleLink>
            <LocaleLink href="/discover" className="flex-1 sm:flex-none">
              <Button variant="outline" size="lg" className="w-full sm:w-auto">
                {createElement(RefreshCw, { className: "mr-2 size-4" })}
                {m.discover_results_discoverAgain()}
              </Button>
            </LocaleLink>
            <LocaleLink href="/discover/history" className="flex-1 sm:flex-none">
              <Button variant="ghost" size="lg" className="w-full sm:w-auto">
                {createElement(Clock, { className: "mr-2 size-4" })}
                {m.discover_results_viewHistory()}
              </Button>
            </LocaleLink>
          </div>
        </motion.div>
      )}
    </div>
  );
}
