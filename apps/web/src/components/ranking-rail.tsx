"use client";

import { ChevronRight } from "lucide-react";
import type { Locale, RankingEntry } from "@liveearth/domain/types";
import { channelLabel, trendGlyph } from "@/lib/format";
import { copy } from "@/lib/i18n";

export function RankingRail({
  entries,
  selectedIndex,
  locale,
  onSelect,
}: {
  entries: RankingEntry[];
  selectedIndex: number;
  locale: Locale;
  onSelect: (index: number) => void;
}) {
  const t = copy[locale];

  return (
    <aside className="ranking-rail" aria-label={t.list}>
      <div className="rail-heading">
        <div>
          <p className="eyebrow">Earth Top 10</p>
          <h2>{locale === "en" ? "Now" : "此刻"}</h2>
        </div>
        <span className="edition-mark">05′</span>
      </div>

      <ol className="ranking-list">
        {entries.map((entry, index) => {
          const active = index === selectedIndex;
          return (
            <li key={entry.scene.id}>
              <button
                className={`ranking-row${active ? " ranking-row--active" : ""}`}
                type="button"
                aria-current={active ? "true" : undefined}
                onClick={() => onSelect(index)}
              >
                <span className="rank-number">{String(entry.rank).padStart(2, "0")}</span>
                <span className="rank-copy">
                  <strong>{entry.scene.city}</strong>
                  <span>
                    {entry.scene.country} · {channelLabel(entry.scene.primaryChannel, locale)}
                  </span>
                </span>
                <span className={`rank-trend rank-trend--${entry.trend}`} aria-label={entry.trend}>
                  {trendGlyph(entry.trend)}
                </span>
                <ChevronRight className="rank-chevron" aria-hidden="true" size={15} />
              </button>
            </li>
          );
        })}
      </ol>
    </aside>
  );
}
