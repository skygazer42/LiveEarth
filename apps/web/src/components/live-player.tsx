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
    if (!video || !playbackUrl || scene.media.kind === "image" || scene.media.kind === "youtube") return;
    let cancelled = false;
    let destroy: (() => void) | undefined;

    async function attachStream() {
      if (!video || !playbackUrl) return;
      if (scene.media.kind === "mp4" || video.canPlayType("application/vnd.apple.mpegurl") || scene.media.kind === "dash") {
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

  if (scene.media.kind === "youtube" && playbackUrl) {
    const embedUrl = new URL(playbackUrl);
    embedUrl.searchParams.set("mute", muted ? "1" : "0");
    return (
      <div className="live-player live-player--embed" data-scene={scene.id}>
        <iframe
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          src={embedUrl.toString()}
          title={`${scene.city} live camera`}
        />
        <span className="live-player-vignette" aria-hidden="true" />
      </div>
    );
  }

  if (scene.media.kind === "image" || !playbackUrl || failed) {
    return (
      <div className="live-player live-player--still" data-scene={scene.id}>
        <SceneImage fit={scene.media.fit ?? "cover"} priority={priority} src={scene.media.posterUrl} />
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
        loop={scene.media.kind === "mp4"}
        muted={muted}
        playsInline
        poster={scene.media.posterUrl}
        preload="metadata"
        src={scene.media.kind === "mp4" ? playbackUrl : undefined}
        style={{ objectFit: scene.media.fit ?? "cover" }}
        onError={() => setFailed(true)}
      />
      <span className="live-player-vignette" aria-hidden="true" />
    </div>
  );
}
