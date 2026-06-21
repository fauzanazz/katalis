import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { Locale } from "@/paraglide/runtime";
import type {
  EarnedBadge,
  GalleryItem,
  Profile,
  QuestProgress,
} from "./types";

/**
 * On-device persistence (IndexedDB). All data is local to the device — there is
 * no sync and no server. Survives app restarts; cleared only by uninstalling or
 * clearing app data.
 */
interface KatalisDB extends DBSchema {
  profiles: { key: string; value: Profile };
  progress: { key: [string, string]; value: QuestProgress; indexes: { byProfile: string } };
  badges: { key: [string, string]; value: EarnedBadge; indexes: { byProfile: string } };
  gallery: { key: string; value: GalleryItem; indexes: { byProfile: string } };
}

let dbPromise: Promise<IDBPDatabase<KatalisDB>> | undefined;

function db(): Promise<IDBPDatabase<KatalisDB>> {
  dbPromise ??= openDB<KatalisDB>("katalis-offline", 1, {
    upgrade(database) {
      database.createObjectStore("profiles", { keyPath: "id" });
      const progress = database.createObjectStore("progress", {
        keyPath: ["profileId", "questId"],
      });
      progress.createIndex("byProfile", "profileId");
      const badges = database.createObjectStore("badges", {
        keyPath: ["profileId", "slug"],
      });
      badges.createIndex("byProfile", "profileId");
      const gallery = database.createObjectStore("gallery", { keyPath: "id" });
      gallery.createIndex("byProfile", "profileId");
    },
  });
  return dbPromise;
}

const uid = (): string =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;

// ── Profiles ─────────────────────────────────────────────────────────────────

export async function listProfiles(): Promise<Profile[]> {
  const all = await (await db()).getAll("profiles");
  return all.sort((a, b) => a.createdAt - b.createdAt);
}

export async function getProfile(id: string): Promise<Profile | undefined> {
  return (await db()).get("profiles", id);
}

export async function createProfile(
  name: string,
  emoji: string,
  locale: Locale,
): Promise<Profile> {
  const profile: Profile = { id: uid(), name, emoji, locale, createdAt: Date.now() };
  await (await db()).put("profiles", profile);
  return profile;
}

export async function deleteProfile(id: string): Promise<void> {
  const database = await db();
  const tx = database.transaction(["profiles", "progress", "badges", "gallery"], "readwrite");
  await tx.objectStore("profiles").delete(id);
  for (const store of ["progress", "badges", "gallery"] as const) {
    const keys = await tx.objectStore(store).index("byProfile").getAllKeys(id);
    await Promise.all(keys.map((key) => tx.objectStore(store).delete(key)));
  }
  await tx.done;
}

// ── Quest progress ───────────────────────────────────────────────────────────

export async function getProgress(
  profileId: string,
  questId: string,
): Promise<QuestProgress | undefined> {
  return (await db()).get("progress", [profileId, questId]);
}

export async function listProgress(profileId: string): Promise<QuestProgress[]> {
  return (await db()).getAllFromIndex("progress", "byProfile", profileId);
}

/** Mark a mission done (idempotent), creating the quest record on first touch. */
export async function completeMission(
  profileId: string,
  questId: string,
  missionId: string,
  totalMissions: number,
): Promise<QuestProgress> {
  const existing = await getProgress(profileId, questId);
  const completedMissionIds = existing
    ? [...new Set([...existing.completedMissionIds, missionId])]
    : [missionId];
  const record: QuestProgress = {
    profileId,
    questId,
    completedMissionIds,
    startedAt: existing?.startedAt ?? Date.now(),
    completedAt:
      completedMissionIds.length >= totalMissions
        ? (existing?.completedAt ?? Date.now())
        : undefined,
  };
  await (await db()).put("progress", record);
  return record;
}

// ── Badges ───────────────────────────────────────────────────────────────────

export async function listBadges(profileId: string): Promise<EarnedBadge[]> {
  return (await db()).getAllFromIndex("badges", "byProfile", profileId);
}

/** Award a badge once; no-op if already earned. Returns true if newly awarded. */
export async function awardBadge(profileId: string, slug: string): Promise<boolean> {
  const database = await db();
  if (await database.get("badges", [profileId, slug])) return false;
  await database.put("badges", { profileId, slug, earnedAt: Date.now() });
  return true;
}

// ── Gallery ──────────────────────────────────────────────────────────────────

export async function listGallery(profileId: string): Promise<GalleryItem[]> {
  const items = await (await db()).getAllFromIndex("gallery", "byProfile", profileId);
  return items.sort((a, b) => b.createdAt - a.createdAt);
}

export async function addGalleryItem(
  item: Omit<GalleryItem, "id" | "createdAt">,
): Promise<GalleryItem> {
  const full: GalleryItem = { ...item, id: uid(), createdAt: Date.now() };
  await (await db()).put("gallery", full);
  return full;
}

export async function deleteGalleryItem(id: string): Promise<void> {
  await (await db()).delete("gallery", id);
}
