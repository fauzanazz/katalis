import type { Locale } from "@/paraglide/runtime";
export type { Locale };

/**
 * Shared data model for the offline build.
 *
 * Content (quests/missions) is authored, bundled, and read-only. User data
 * (profiles, progress, badges, gallery) lives on-device in IndexedDB. Nothing
 * here touches a network or a server.
 */

/** Authored text in every supported locale. Render with `t(value)`. */
export type LocalizedText = Record<Locale, string>;

/** Resolve a LocalizedText for the active locale, falling back to id → en. */
export function t(value: LocalizedText, locale: Locale): string {
  return value[locale] || value.id || value.en || "";
}

// ── Bundled content (read-only) ──────────────────────────────────────────────

export interface Mission {
  /** Stable id, unique across the catalog (e.g. "robot-d1"). */
  id: string;
  /** 1-based day within the quest. */
  day: number;
  title: LocalizedText;
  /** Ordered steps the child follows. */
  instructions: LocalizedText[];
  /** Things to gather first. */
  materials: LocalizedText[];
  /** Encouraging hints. */
  tips: LocalizedText[];
}

export interface Quest {
  /** Stable id, unique across the catalog (e.g. "robot"). */
  id: string;
  /** Theme/talent slug, e.g. "engineering" | "narrative" | "art" | "nature". */
  theme: string;
  /** Avatar/illustration emoji shown on cards. */
  emoji: string;
  /** Optional bundled illustration (path under public/, e.g. "/story-prompts/treasure-map.webp"). */
  image?: string;
  title: LocalizedText;
  /** First-person aspiration, e.g. "I want to build robots that help people". */
  dream: LocalizedText;
  /** One-line pitch shown in the catalog. */
  summary: LocalizedText;
  /** What talent/skill this nurtures, shown on the discover card. */
  talent: LocalizedText;
  missions: Mission[];
}

// ── On-device user data (read/write, IndexedDB) ──────────────────────────────

export interface Profile {
  id: string;
  name: string;
  /** Avatar emoji. */
  emoji: string;
  locale: Locale;
  createdAt: number;
}

export interface QuestProgress {
  profileId: string;
  questId: string;
  completedMissionIds: string[];
  startedAt: number;
  completedAt?: number;
}

export interface EarnedBadge {
  profileId: string;
  /** Badge slug from src/lib/badges/definitions. */
  slug: string;
  earnedAt: number;
}

export interface GalleryItem {
  id: string;
  profileId: string;
  questId?: string;
  missionId?: string;
  /** Captured/selected image as a data URL (stored locally). */
  imageDataUrl: string;
  caption: string;
  createdAt: number;
}

/** A single mentor chat turn. */
export interface MentorMessage {
  role: "user" | "assistant";
  content: string;
}
