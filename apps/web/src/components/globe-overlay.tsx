"use client";

import { X } from "lucide-react";
import type { Locale, RankingEntry } from "@liveearth/domain/types";
import { channelLabel, formatCoordinates } from "@/lib/format";
import { copy } from "@/lib/i18n";
import { EarthGlobe } from "./earth-globe";

export function GlobeOverlay({
  entries,
  selectedIndex,
  locale,
  onClose,
  onSelect,
}: {
  entries: RankingEntry[];
  selectedIndex: number;
  locale: Locale;
  onClose: () => void;
  onSelect: (index: number) => void;
}) {
  const t = copy[locale];
  const selected = entries[selectedIndex] ?? entries[0];
  if (!selected) return null;

  return (
    <div className="globe-overlay" role="dialog" aria-modal="true" aria-label={t.globe}>
      <button className="globe-close" type="button" aria-label="Close globe" onClick={onClose}>
        <X aria-hidden="true" />
      </button>
      <div className="globe-copy">
        <p className="eyebrow">Live coordinates · {String(selected.rank).padStart(2, "0")}</p>
        <h2>{selected.scene.city}</h2>
        <p>{selected.scene.analysis.reason[locale]}</p>
        <div className="globe-coordinate-line">
          <span>{formatCoordinates(selected.scene.latitude, selected.scene.longitude)}</span>
          <span>{channelLabel(selected.scene.primaryChannel, locale)}</span>
        </div>
      </div>

      <div className="globe-canvas" aria-hidden="true">
        <EarthGlobe entries={entries} selectedIndex={selectedIndex} />
      </div>

      <ol className="globe-scene-strip" aria-label={t.list}>
        {entries.map((entry, index) => (
          <li key={entry.scene.id}>
            <button
              type="button"
              className={index === selectedIndex ? "is-active" : undefined}
              onClick={() => onSelect(index)}
            >
              <span>{String(entry.rank).padStart(2, "0")}</span>
              <strong>{entry.scene.city}</strong>
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}
