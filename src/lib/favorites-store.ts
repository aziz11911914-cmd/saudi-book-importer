// Local favorites store — bridges UX before OTP auth ships.
// Mirrors the public.favorites schema (target_type: barber | shop) and
// extends it with "style" for haircut photos. When auth lands, swap to
// a Supabase-backed implementation for the two server-side target types.

import { useSyncExternalStore } from "react";

export type FavoriteType = "barber" | "shop" | "style";

export type Favorite = {
  type: FavoriteType;
  id: string;
  // Denormalized snapshot so favorites list can render without re-fetching.
  snapshot: {
    title_en: string;
    title_ar: string;
    subtitle_en?: string;
    subtitle_ar?: string;
    image_url?: string | null;
  };
  created_at: string;
};

const KEY = "qassah.favorites.v1";
const EVENT = "qassah:favorites-changed";

// Cached snapshot — useSyncExternalStore requires referential stability
// between renders, otherwise it triggers an infinite update loop.
let cache: Favorite[] | null = null;
const EMPTY: Favorite[] = [];

function read(): Favorite[] {
  if (typeof window === "undefined") return EMPTY;
  if (cache) return cache;
  try {
    const raw = window.localStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as Favorite[]) : [];
    cache = list.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    return cache;
  } catch {
    cache = EMPTY;
    return cache;
  }
}

function write(list: Favorite[]) {
  if (typeof window === "undefined") return;
  cache = [...list].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  window.localStorage.setItem(KEY, JSON.stringify(cache));
  window.dispatchEvent(new CustomEvent(EVENT));
}

export function listFavorites(): Favorite[] {
  return read();
}

export function isFavorited(type: FavoriteType, id: string) {
  return read().some((f) => f.type === type && f.id === id);
}

export function toggleFavorite(fav: Omit<Favorite, "created_at">) {
  const list = [...read()];
  const idx = list.findIndex((f) => f.type === fav.type && f.id === fav.id);
  if (idx >= 0) {
    list.splice(idx, 1);
  } else {
    list.unshift({ ...fav, created_at: new Date().toISOString() });
  }
  write(list);
  return idx < 0;
}

function subscribe(cb: () => void) {
  if (typeof window === "undefined") return () => {};
  const fn = () => {
    // Invalidate cache so next read pulls from storage (cross-tab updates).
    cache = null;
    cb();
  };
  window.addEventListener(EVENT, fn);
  window.addEventListener("storage", fn);
  return () => {
    window.removeEventListener(EVENT, fn);
    window.removeEventListener("storage", fn);
  };
}

export function useFavorites(): Favorite[] {
  return useSyncExternalStore(subscribe, listFavorites, () => EMPTY);
}

export function useIsFavorited(type: FavoriteType, id: string): boolean {
  return useSyncExternalStore(
    subscribe,
    () => isFavorited(type, id),
    () => false,
  );
}
