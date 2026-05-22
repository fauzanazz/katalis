"use client";

import { useEffect, useState } from "react";

const GUEST_ID_KEY = "katalis_guest_id";

type AuthState = "loading" | "child" | "parent" | "unauthenticated";

interface UseChildIdResult {
  childId: string | null;
  isGuest: boolean;
}

/**
 * Resolves the active child ID for discover/quest pages.
 * - Logged-in child: uses session childId, reflects in URL as ?cid=
 * - Guest: generates a UUID, persists in localStorage, reflects in URL as ?cid=
 * - Parent: returns null, no URL update
 */
export function useChildId(
  authState: AuthState,
  sessionChildId: string | null,
): UseChildIdResult {
  const [childId, setChildId] = useState<string | null>(null);

  useEffect(() => {
    if (authState === "loading" || authState === "parent") return;

    let id: string;
    if (authState === "child" && sessionChildId) {
      id = sessionChildId;
    } else {
      let guestId = localStorage.getItem(GUEST_ID_KEY);
      if (!guestId) {
        guestId = crypto.randomUUID();
        localStorage.setItem(GUEST_ID_KEY, guestId);
      }
      id = guestId;
    }

    setChildId(id);

    const params = new URLSearchParams(window.location.search);
    if (params.get("cid") !== id) {
      params.set("cid", id);
      const newUrl = `${window.location.pathname}?${params.toString()}`;
      window.history.replaceState(null, "", newUrl);
    }
  }, [authState, sessionChildId]);

  return {
    childId,
    isGuest: authState === "unauthenticated",
  };
}
