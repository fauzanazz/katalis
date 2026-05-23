/**
 * Client-side localStorage helpers for guest analysis history.
 * Max 2 entries — newest first.
 */

import type { Talent } from "@/lib/ai/schemas";

export const GUEST_HISTORY_KEY = "katalis_guest_history";
export const GUEST_ANALYSIS_LIMIT = 2;

export interface GuestHistoryItem {
  id: string;
  type: "artifact" | "story" | "audio";
  fileUrl: string | null;
  talents: Talent[];
  createdAt: string;
}

export function readGuestHistory(): GuestHistoryItem[] {
  try {
    const raw = localStorage.getItem(GUEST_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function addToGuestHistory(
  item: Omit<GuestHistoryItem, "id" | "createdAt">,
): GuestHistoryItem {
  const newItem: GuestHistoryItem = {
    ...item,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };
  try {
    const existing = readGuestHistory();
    // Prepend newest; keep only GUEST_ANALYSIS_LIMIT entries
    const updated = [newItem, ...existing].slice(0, GUEST_ANALYSIS_LIMIT);
    localStorage.setItem(GUEST_HISTORY_KEY, JSON.stringify(updated));
  } catch {
    // Ignore storage errors
  }
  return newItem;
}

export function clearGuestHistory(): void {
  try {
    localStorage.removeItem(GUEST_HISTORY_KEY);
  } catch {
    // Ignore
  }
}

export function getGuestAnalysisCount(): number {
  return readGuestHistory().length;
}
