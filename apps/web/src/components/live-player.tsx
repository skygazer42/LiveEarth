"use client";

import { useEffect, useRef, useState } from "react";
import type { Scene } from "@liveearth/domain/types";
import { SceneImage } from "./scene-image";

export function LivePlayer({ scene, muted, priority = false }: { scene: Scene; muted: boolean; priority?: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);
  const playbackUrl = scene.media.playbackUrl;

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !playbackUrl || scene.media.kind === "image") return;
    let cancelled = false;
    let destroy: (() => void) | undefined;

    async function attachStream() {
      if (!video || !playbackUrl) return;
      if (video.canPlayType("application/vnd.apple.mpegurl") || scene.media.kind === "dash") {
        video.src = playbackUrl;
        await video.play().catch(() => undefined);
        return;
      }

      const { default: Hls } = await import("hls.js");
      if (cancelled || !Hls.isSupported()) {
        setFailed(true);
        return;
      }
      const hls = new Hls({
        lowLatencyMode: true,
        backBufferLength: 30,
        maxBufferLength: 12,
      });
      hls.loadSource(playbackUrl);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        void video.play().catch(() => undefined);
      });
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) setFailed(true);
      });
      destroy = () => hls.destroy();
    }

    void attachStream();
    return () => {
      cancelled = true;
      destroy?.();
    };
  }, [playbackUrl, scene.media.kind]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = muted;
  }, [muted]);

  if (scene.media.kind === "image" || !playbackUrl || failed) {
    return (
      <div className="live-player live-player--still" data-scene={scene.id}>
        <SceneImage priority={priority} src={scene.media.posterUrl} />
        <span className="live-player-vignette" aria-hidden="true" />
        {failed ? <p className="player-error">Live stream unavailable — showing latest verified frame</p> : null}
      </div>
    );
  }

  return (
    <div className="live-player" data-scene={scene.id}>
      <video
        ref={videoRef}
        aria-label={`${scene.city} live camera`}
        autoPlay
        muted={muted}
        playsInline
        poster={scene.media.posterUrl}
        onError={() => setFailed(true)}
      />
      <span className="live-player-vignette" aria-hidden="true" />
    </div>
  );
}
