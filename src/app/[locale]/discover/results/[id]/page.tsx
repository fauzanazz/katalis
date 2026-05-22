"use client";

import { createElement, useEffect, useState, useCallback } from "react";
import { motion } from "motion/react";
import { useTranslations } from "next-intl";
import { useParams } from "next/navigation";
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
  SearchX,
  RefreshCw,
  Rocket,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import type { Talent } from "@/lib/ai/schemas";

interface DiscoveryResult {
  id: string;
  type: string;
  fileUrl: string | null;
  talents: Talent[];
  createdAt: string;
}

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

function getTalentLevel(
  confidence: number,
  t: ReturnType<typeof useTranslations>,
): { label: string; style: { bg: string; text: string } } {
  if (confidence >= 0.85)
    return { label: t("naturalGift"), style: { bg: "#fef3c7", text: "#92400e" } };
  if (confidence >= 0.70)
    return { label: t("strongTalent"), style: { bg: "#dbeafe", text: "#1e3a8a" } };
  if (confidence >= 0.55)
    return { label: t("genuineInterest"), style: { bg: "#dcfce7", text: "#14532d" } };
  return { label: t("emergingSkill"), style: { bg: "#f3e8ff", text: "#581c87" } };
}

// Skeleton matching the page shape
function ResultSkeleton() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:py-12">
      <div className="mb-6 flex items-center justify-between">
        <div className="h-9 w-28 animate-pulse rounded-xl bg-stone-100" />
        <div className="h-9 w-28 animate-pulse rounded-xl bg-stone-100" />
      </div>
      <div className="mb-8 flex flex-col items-center gap-3">
        <div className="size-14 animate-pulse rounded-full bg-amber-100" />
        <div className="h-9 w-56 animate-pulse rounded-xl bg-stone-100" />
        <div className="h-5 w-40 animate-pulse rounded-lg bg-stone-100" />
        <div className="flex gap-3">
          <div className="h-6 w-32 animate-pulse rounded-full bg-stone-100" />
          <div className="h-6 w-32 animate-pulse rounded-full bg-stone-100" />
        </div>
      </div>
      <div className="mb-4 h-52 animate-pulse rounded-3xl bg-amber-50" />
      <div className="grid grid-cols-2 gap-4">
        <div className="h-36 animate-pulse rounded-2xl bg-stone-100" />
        <div className="h-36 animate-pulse rounded-2xl bg-stone-100" />
      </div>
    </div>
  );
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

// Champion card — rank 1, full width, prominent
function ChampionCard({
  talent,
  palette,
  t,
}: {
  talent: Talent;
  palette: PaletteEntry;
  t: ReturnType<typeof useTranslations>;
}) {
  const iconComponent = getTalentIcon(talent.name);
  const level = getTalentLevel(talent.confidence, t);
  const pct = Math.round(talent.confidence * 100);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
      className="relative overflow-hidden rounded-3xl p-6 sm:p-8"
      style={{ backgroundColor: palette.bg, border: `1.5px solid ${palette.border}` }}
      role="article"
      aria-label={t("talentCardLabel", { name: talent.name })}
    >
      {/* Decorative circle in corner */}
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

      {/* Rank badge */}
      <div
        className="absolute right-5 top-5 flex size-10 items-center justify-center rounded-full text-base font-black text-white shadow-sm sm:size-12 sm:text-lg"
        style={{ backgroundColor: palette.accent }}
        aria-label="Rank 1"
      >
        1
      </div>

      {/* Icon */}
      <div
        className="mb-5 flex size-14 items-center justify-center rounded-2xl sm:size-16"
        style={{ backgroundColor: palette.iconBg }}
      >
        {createElement(iconComponent, { size: 28, color: palette.accent, strokeWidth: 1.75 })}
      </div>

      {/* Name + level badge */}
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

      {/* Confidence bar + percentage */}
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

      {/* Reasoning */}
      <p className="text-sm leading-relaxed" style={{ color: palette.text }}>
        {talent.reasoning}
      </p>
    </motion.div>
  );
}

// Compact talent card — rank 2+
function TalentCard({
  talent,
  palette,
  rank,
  delay,
  t,
}: {
  talent: Talent;
  palette: PaletteEntry;
  rank: number;
  delay: number;
  t: ReturnType<typeof useTranslations>;
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
      aria-label={t("talentCardLabel", { name: talent.name })}
    >
      {/* Rank + icon + name */}
      <div className="mb-3 flex items-center gap-2">
        <span
          className="flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-black text-white"
          style={{ backgroundColor: palette.accent }}
        >
          {rank}
        </span>
        {createElement(iconComponent, { size: 15, color: palette.accent, strokeWidth: 2 })}
        <h3
          className="line-clamp-1 flex-1 text-sm font-bold text-ink"
        >
          {talent.name}
        </h3>
        <span
          className="shrink-0 text-sm font-black tabular-nums"
          style={{ color: palette.accent }}
        >
          {pct}%
        </span>
      </div>

      {/* Confidence bar */}
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

      {/* Reasoning */}
      <p className="line-clamp-2 text-xs leading-relaxed" style={{ color: palette.text }}>
        {talent.reasoning}
      </p>
    </motion.div>
  );
}

function getTypeIcon(type: string) {
  switch (type) {
    case "artifact": return <ImageIcon className="size-4" />;
    case "story":    return <BookOpen className="size-4" />;
    default:         return <Mic className="size-4" />;
  }
}

export default function DiscoveryResultsPage() {
  const t = useTranslations("discover.results");
  const params = useParams();
  const discoveryId = params.id as string;

  const [result, setResult] = useState<DiscoveryResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [shareMessage, setShareMessage] = useState<string | null>(null);

  useEffect(() => {
    async function fetchResult() {
      try {
        const res = await fetch(`/api/discovery/${discoveryId}`);
        if (!res.ok) { setError(true); return; }
        setResult(await res.json());
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    }
    fetchResult();
  }, [discoveryId]);

  const handleShare = useCallback(async () => {
    const url = window.location.href;
    const title = t("shareTitle");
    if (typeof navigator !== "undefined" && navigator.share) {
      try { await navigator.share({ title, url }); return; } catch { /* fall through */ }
    }
    try {
      await navigator.clipboard.writeText(url);
      setShareMessage(t("shareCopied"));
    } catch {
      setShareMessage(t("shareError"));
    }
    setTimeout(() => setShareMessage(null), 3000);
  }, [t]);

  if (loading) return <ResultSkeleton />;

  if (error || !result) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col items-center justify-center px-4 py-24 text-center">
        <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-stone-100">
          <SearchX className="size-7 text-stone-400" />
        </div>
        <h2 className="text-xl font-bold text-ink">{t("notFound")}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{t("notFoundDesc")}</p>
        <Link href="/discover" className="mt-6">
          <Button variant="outline">
            <ArrowLeft className="mr-2 size-4" />
            {t("backToDiscover")}
          </Button>
        </Link>
      </div>
    );
  }

  const [champion, ...rest] = result.talents;
  const topTalentName = champion?.name ?? "";

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "artifact": return t("artifactType");
      case "story":    return t("storyType");
      default:         return t("audioType");
    }
  };

  return (
    <div className="relative mx-auto w-full max-w-2xl px-4 py-8 sm:py-12">
      <FloatingDots />

      {/* Top nav */}
      <div className="relative mb-6 flex items-center justify-between">
        <Link href="/discover">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-1 size-4" />
            {t("backToDiscover")}
          </Button>
        </Link>
        <Button variant="outline" size="sm" onClick={handleShare}>
          <Share2 className="mr-1 size-4" />
          {t("share")}
        </Button>
      </div>

      {/* Share feedback */}
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
          <Compass className="size-8 text-amber-600" />
        </motion.div>

        <h1 className="text-3xl font-black tracking-tight text-ink sm:text-4xl">
          {t("pageTitle")}
        </h1>
        <p className="mt-2 text-muted-foreground">{t("pageSubtitle")}</p>

        {/* Metadata chips */}
        <div className="mt-4 flex items-center justify-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5 rounded-full bg-stone-100 px-3 py-1">
            {getTypeIcon(result.type)}
            {getTypeLabel(result.type)}
          </span>
          <span className="flex items-center gap-1.5 rounded-full bg-stone-100 px-3 py-1">
            <Clock className="size-3.5" />
            {t("dateLabel", { date: new Date(result.createdAt).toLocaleDateString() })}
          </span>
        </div>
      </motion.div>

      {/* Champion talent */}
      {champion && (
        <div className="mb-4">
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.25 }}
            className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground"
          >
            {t("topTalent")}
          </motion.p>
          <ChampionCard talent={champion} palette={PALETTE[0]} t={t} />
        </div>
      )}

      {/* Other talents */}
      {rest.length > 0 && (
        <div className="mb-6 mt-6">
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground"
          >
            {t("moreTalents")}
          </motion.p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {rest.map((talent, idx) => (
              <TalentCard
                key={`${talent.name}-${idx}`}
                talent={talent}
                palette={PALETTE[(idx + 1) % PALETTE.length]}
                rank={idx + 2}
                delay={0.55 + idx * 0.1}
                t={t}
              />
            ))}
          </div>
        </div>
      )}

      {/* Quest CTA banner */}
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
              <Rocket size={22} color="#d97706" strokeWidth={1.75} />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-black text-ink">{t("readyForQuest")}</h3>
              <p className="mt-1 text-sm text-amber-800">
                {t("questDesc", { talent: topTalentName })}
              </p>
            </div>
          </div>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <Link href="/quest" className="flex-1 sm:flex-none">
              <Button size="lg" className="w-full sm:w-auto">
                <Rocket className="mr-2 size-4" />
                {t("startQuest")}
              </Button>
            </Link>
            <Link href="/discover" className="flex-1 sm:flex-none">
              <Button variant="outline" size="lg" className="w-full sm:w-auto">
                <RefreshCw className="mr-2 size-4" />
                {t("discoverAgain")}
              </Button>
            </Link>
            <Link href="/discover/history" className="flex-1 sm:flex-none">
              <Button variant="ghost" size="lg" className="w-full sm:w-auto">
                <Clock className="mr-2 size-4" />
                {t("viewHistory")}
              </Button>
            </Link>
          </div>
        </motion.div>
      )}
    </div>
  );
}
