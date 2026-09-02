"use client";

import { Volume2, VolumeX } from "lucide-react";
import { useEffect, useState } from "react";
import type { Locale, Scene } from "@liveearth/domain/types";
import { copy } from "@/lib/i18n";
import { FavoriteButton } from "./favorite-button";
import { useFavorites } from "./favorites-provider";
import { LivePlayer } from "./live-player";

export function ScenePlayerPanel({ scene, locale }: { scene: Scene; locale: Locale }) {
  const [muted, setMuted] = useState(true);
  const { recordView } = useFavorites();
  const t = copy[locale];

  useEffect(() => recordView(scene.id), [recordView, scene.id]);

  return (
    <div className="scene-player-panel">
      <LivePlayer scene={scene} muted={muted} priority />
      <div className="scene-player-status">
        <span className="live-badge">
          <i aria-hidden="true" /> {scene.media.mode === "near-live" ? t.nearLive : t.live}
        </span>
        {scene.media.demoOnly ? <span className="preview-badge">{t.preview}</span> : null}
      </div>
      <div className="scene-player-tools">
        <button
          type="button"
          className="sound-control"
          disabled={!scene.media.audio}
          onClick={() => setMuted((value) => !value)}
        >
          {muted ? <VolumeX aria-hidden="true" /> : <Volume2 aria-hidden="true" />}
          {muted ? t.soundOn : t.soundOff}
        </button>
        <FavoriteButton sceneId={scene.id} label={locale === "en" ? "Save scene" : "收藏场景"} />
      </div>
    </div>
  );
}
