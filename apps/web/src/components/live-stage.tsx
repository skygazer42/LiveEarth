"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowRight, Globe2, List, Pause, Play, SkipForward, Volume2, VolumeX } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Locale, RankingSnapshot } from "@liveearth/domain/types";
import { channelLabel, formatCoordinates, formatTime } from "@/lib/format";
import { copy } from "@/lib/i18n";
import { useRankingSnapshot } from "@/lib/use-ranking-snapshot";
import { EmptyChannel } from "./empty-channel";
import { FavoriteButton } from "./favorite-button";
import { useFavorites } from "./favorites-provider";
import { LivePlayer } from "./live-player";
import { RankingRail } from "./ranking-rail";

const GlobeOverlay = dynamic(
  () => import("./globe-overlay").then((module) => module.GlobeOverlay),
  { ssr: false },
);

const TOUR_SECONDS = 45;

export function LiveStage({ snapshot, locale }: { snapshot: RankingSnapshot; locale: Locale }) {
  const t = copy[locale];
  const currentSnapshot = useRankingSnapshot(snapshot);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [touring, setTouring] = useState(true);
  const [muted, setMuted] = useState(true);
  const [globeOpen, setGlobeOpen] = useState(false);
  const resumeTimer = useRef<number | null>(null);
  const { recordView } = useFavorites();
  const entries = currentSnapshot.entries;
  const activeIndex = selectedIndex < entries.length ? selectedIndex : 0;
  const entry = entries[activeIndex];
  const preloadEntry = entries.length > 1 ? entries[(activeIndex + 1) % entries.length] : undefined;

  const pauseForBrowsing = useCallback(() => {
    setTouring(false);
    if (resumeTimer.current !== null) window.clearTimeout(resumeTimer.current);
    resumeTimer.current = window.setTimeout(() => {
      setTouring(true);
      resumeTimer.current = null;
    }, 2 * 60_000);
  }, []);

  const select = useCallback(
    (index: number, manual = true) => {
      if (entries.length === 0) return;
      setSelectedIndex(((index % entries.length) + entries.length) % entries.length);
      if (manual) pauseForBrowsing();
    },
    [entries.length, pauseForBrowsing],
  );

  const next = useCallback(
    (manual = true) => select(activeIndex + 1, manual),
    [activeIndex, select],
  );

  useEffect(() => {
    if (!touring || entries.length < 2 || globeOpen) return;
    const timer = window.setTimeout(() => next(false), TOUR_SECONDS * 1_000);
    return () => window.clearTimeout(timer);
  }, [activeIndex, entries.length, globeOpen, next, touring]);

  useEffect(
    () => () => {
      if (resumeTimer.current !== null) window.clearTimeout(resumeTimer.current);
    },
    [],
  );

  useEffect(() => {
    if (entry) recordView(entry.scene.id);
  }, [entry, recordView]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      if (event.key === "ArrowRight") next();
      if (event.key === "ArrowLeft") select(activeIndex - 1);
      if (event.key.toLowerCase() === "g") setGlobeOpen(true);
      if (event.key === "Escape") setGlobeOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeIndex, next, select]);

  const localNow = entry
    ? formatTime(entry.scene.health.checkedAt, locale, entry.scene.timezone)
    : "";

  if (!entry) return <EmptyChannel channel="earth" locale={locale} />;
  const scene = entry.scene;
  const reason = scene.analysis.reason[locale];

  return (
    <div className="broadcast-shell">
      <section className="stage" aria-live="polite">
        <div className="stage-media" key={scene.id}>
          <LivePlayer scene={scene} muted={muted} priority={activeIndex === 0} />
        </div>
        {preloadEntry ? (
          <div className="stage-preload" aria-hidden="true">
            <LivePlayer scene={preloadEntry.scene} muted />
          </div>
        ) : null}

        <div className="stage-topline">
          <span className="live-badge">
            <i aria-hidden="true" /> {t.live}
          </span>
          <span>{channelLabel(scene.primaryChannel, locale)}</span>
          <span>{localNow}</span>
          {currentSnapshot.isDemo ? <span className="preview-badge">{t.preview}</span> : null}
        </div>

        <div className="stage-caption">
          <p className="stage-place">
            {scene.region} · {scene.country}
          </p>
          <h1>{scene.city}</h1>
          <p className="stage-title">{scene.title[locale]}</p>
          <div className="director-note">
            <span>{t.aiDirector}</span>
            <p>{reason}</p>
          </div>
          <div className="stage-meta">
            <span>{formatCoordinates(scene.latitude, scene.longitude)}</span>
            <span>{scene.analysis.editorialScore.toFixed(1)} / 100</span>
            <Link href={`/${locale}/scene/${scene.slug}`}>
              {t.details} <ArrowRight aria-hidden="true" size={14} />
            </Link>
          </div>
        </div>

        <div className="stage-actions">
          <button
            type="button"
            className="round-control"
            aria-label={touring ? t.pause : t.resume}
            onClick={() => {
              if (resumeTimer.current !== null) {
                window.clearTimeout(resumeTimer.current);
                resumeTimer.current = null;
              }
              setTouring((value) => !value);
            }}
          >
            {touring ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
          </button>
          <button type="button" className="round-control" aria-label={t.next} onClick={() => next()}>
            <SkipForward aria-hidden="true" />
          </button>
          <button
            type="button"
            className="sound-control"
            aria-label={muted ? t.soundOn : t.soundOff}
            disabled={!scene.media.audio}
            title={!scene.media.audio ? "Audio is not licensed for this source" : undefined}
            onClick={() => setMuted((value) => !value)}
          >
            {muted ? <VolumeX aria-hidden="true" size={17} /> : <Volume2 aria-hidden="true" size={17} />}
            <span>{muted ? t.soundOn : t.soundOff}</span>
          </button>
          <FavoriteButton sceneId={scene.id} label={locale === "en" ? "Save scene" : "收藏场景"} />
        </div>

        <button className="globe-control" type="button" onClick={() => setGlobeOpen(true)}>
          <Globe2 aria-hidden="true" size={17} /> {t.globe}
          <span className="shortcut">G</span>
        </button>

        {touring ? (
          <span className="tour-progress" key={`${scene.id}-${activeIndex}`} aria-hidden="true" />
        ) : null}
      </section>

      <RankingRail entries={entries} selectedIndex={activeIndex} locale={locale} onSelect={select} />

      <div className="mobile-stage-switcher" aria-hidden="true">
        <List size={14} /> {t.list}
      </div>

      {globeOpen ? (
        <GlobeOverlay
          entries={entries}
          locale={locale}
          selectedIndex={activeIndex}
          onClose={() => setGlobeOpen(false)}
          onSelect={(index) => {
            select(index);
            setGlobeOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}
