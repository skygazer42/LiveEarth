"use client";

import { Bookmark } from "lucide-react";
import { useFavorites } from "./favorites-provider";

export function FavoriteButton({ sceneId, label }: { sceneId: string; label: string }) {
  const { isFavorite, toggleFavorite } = useFavorites();
  const active = isFavorite(sceneId);

  return (
    <button
      className={`favorite-button${active ? " favorite-button--active" : ""}`}
      type="button"
      aria-label={label}
      aria-pressed={active}
      onClick={() => {
        toggleFavorite(sceneId);
        if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
          const url = `/api/v1/me/favorites${active ? `?sceneId=${encodeURIComponent(sceneId)}` : ""}`;
          const options: RequestInit = active
            ? { method: "DELETE" }
            : {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ sceneId }),
              };
          void fetch(url, options).catch(() => undefined);
        }
      }}
    >
      <Bookmark aria-hidden="true" fill={active ? "currentColor" : "none"} size={18} strokeWidth={1.5} />
    </button>
  );
}
