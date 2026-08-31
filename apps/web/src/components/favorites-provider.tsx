"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";

const STORAGE_KEY = "liveearth:user-state:v1";
const MAX_HISTORY = 100;
const EMPTY_STATE: StoredState = { version: 1, favorites: [], history: [] };
const listeners = new Set<() => void>();
let cachedState: StoredState | null = null;

interface StoredState {
  version: 1;
  favorites: string[];
  history: string[];
}

interface FavoritesContextValue {
  favorites: string[];
  history: string[];
  hydrated: boolean;
  toggleFavorite: (sceneId: string) => void;
  isFavorite: (sceneId: string) => boolean;
  recordView: (sceneId: string) => void;
  clearHistory: () => void;
  clearAll: () => void;
  mergeRemote: (favorites: string[], history: string[]) => void;
}

const FavoritesContext = createContext<FavoritesContextValue | null>(null);

function readStoredState(): StoredState {
  if (typeof window === "undefined") return EMPTY_STATE;
  if (cachedState) return cachedState;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      cachedState = EMPTY_STATE;
      return cachedState;
    }
    const value = JSON.parse(raw) as Partial<StoredState>;
    cachedState = {
      version: 1,
      favorites: Array.isArray(value.favorites) ? value.favorites.filter(isString) : [],
      history: Array.isArray(value.history) ? value.history.filter(isString) : [],
    };
    return cachedState;
  } catch {
    cachedState = EMPTY_STATE;
    return cachedState;
  }
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function persist(state: StoredState) {
  cachedState = state;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // The in-memory library remains usable when storage is unavailable or full.
  }
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY) return;
    cachedState = null;
    listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function subscribeHydration() {
  return () => undefined;
}

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const state = useSyncExternalStore(subscribe, readStoredState, () => EMPTY_STATE);
  const hydrated = useSyncExternalStore(subscribeHydration, () => true, () => false);

  const update = useCallback((recipe: (current: StoredState) => StoredState) => {
    persist(recipe(readStoredState()));
  }, []);

  const toggleFavorite = useCallback(
    (sceneId: string) => {
      update((current) => ({
        ...current,
        favorites: current.favorites.includes(sceneId)
          ? current.favorites.filter((id) => id !== sceneId)
          : [sceneId, ...current.favorites],
      }));
    },
    [update],
  );

  const recordView = useCallback(
    (sceneId: string) => {
      update((current) => ({
        ...current,
        history: [sceneId, ...current.history.filter((id) => id !== sceneId)].slice(
          0,
          MAX_HISTORY,
        ),
      }));
      if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
        void fetch("/api/v1/me/history", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ sceneId }),
        }).catch(() => undefined);
      }
    },
    [update],
  );

  const clearHistory = useCallback(() => {
    update((current) => ({ ...current, history: [] }));
    if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
      void fetch("/api/v1/me/history", { method: "DELETE" }).catch(() => undefined);
    }
  }, [update]);

  const clearAll = useCallback(() => {
    persist(EMPTY_STATE);
  }, []);

  const mergeRemote = useCallback(
    (favorites: string[], history: string[]) => {
      update((current) => ({
        ...current,
        favorites: [...new Set([...favorites, ...current.favorites])],
        history: [...new Set([...history, ...current.history])].slice(0, MAX_HISTORY),
      }));
    },
    [update],
  );

  const value = useMemo<FavoritesContextValue>(
    () => ({
      favorites: state.favorites,
      history: state.history,
      hydrated,
      toggleFavorite,
      isFavorite: (sceneId) => state.favorites.includes(sceneId),
      recordView,
      clearHistory,
      clearAll,
      mergeRemote,
    }),
    [
      clearAll,
      clearHistory,
      hydrated,
      mergeRemote,
      recordView,
      state.favorites,
      state.history,
      toggleFavorite,
    ],
  );

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

export function useFavorites(): FavoritesContextValue {
  const value = useContext(FavoritesContext);
  if (!value) throw new Error("useFavorites must be used inside FavoritesProvider");
  return value;
}
