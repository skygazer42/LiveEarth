"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { Channel, Locale, RankingSnapshot } from "@liveearth/domain/types";
import { channelLabel, formatCoordinates, trendGlyph } from "@/lib/format";
import { copy } from "@/lib/i18n";
import { useRankingSnapshot } from "@/lib/use-ranking-snapshot";
import { EmptyChannel } from "./empty-channel";
import { FavoriteButton } from "./favorite-button";
import { SceneImage } from "./scene-image";

export function ChannelEdition({
  channel,
  locale,
  snapshot,
}: {
  channel: Exclude<Channel, "earth">;
  locale: Locale;
  snapshot: RankingSnapshot;
}) {
  const t = copy[locale];
  const currentSnapshot = useRankingSnapshot(snapshot);
  const lead = currentSnapshot.entries[0];
  if (!lead) return <EmptyChannel channel={channel} locale={locale} />;

  return (
    <div className={`channel-edition channel-edition--${channel}`}>
      <section className="channel-lead">
        <SceneImage priority src={lead.scene.media.posterUrl} />
        <span className="channel-lead-shade" aria-hidden="true" />
        <div className="channel-masthead">
          <p className="eyebrow">{t.channelKicker} · {formatTimeLabel(currentSnapshot.generatedAt, locale)}</p>
          <h1>Live{channel[0]?.toUpperCase()}{channel.slice(1)}</h1>
          <p>{t.channelDescription[channel]}</p>
        </div>
        <div className="lead-scene">
          <span className="rank-number">01</span>
          <div>
            <p>{lead.scene.country}</p>
            <h2>{lead.scene.city}</h2>
            <p>{lead.scene.analysis.reason[locale]}</p>
          </div>
          <Link href={`/${locale}/scene/${lead.scene.slug}`} aria-label={`${lead.scene.city} ${t.details}`}>
            <ArrowUpRight aria-hidden="true" />
          </Link>
        </div>
      </section>

      <section className="channel-ranking" aria-labelledby="channel-ranking-title">
        <div className="channel-ranking-head">
          <div>
            <p className="eyebrow">Top {currentSnapshot.entries.length} · {t.updated} {formatTimeLabel(currentSnapshot.generatedAt, locale)}</p>
            <h2 id="channel-ranking-title">{locale === "en" ? "The current edition" : "本期榜单"}</h2>
          </div>
          <p>{t.channelDescription[channel]}</p>
        </div>
        <ol>
          {currentSnapshot.entries.map((entry) => (
            <li key={entry.scene.id}>
              <span className="channel-row-rank">{String(entry.rank).padStart(2, "0")}</span>
              <Link className="channel-row-image" href={`/${locale}/scene/${entry.scene.slug}`}>
                <SceneImage src={entry.scene.media.posterUrl} />
              </Link>
              <div className="channel-row-main">
                <p>{entry.scene.country} · {channelLabel(entry.scene.primaryChannel, locale)}</p>
                <h3>
                  <Link href={`/${locale}/scene/${entry.scene.slug}`}>{entry.scene.city}</Link>
                </h3>
                <p>{entry.scene.analysis.reason[locale]}</p>
              </div>
              <div className="channel-row-score">
                <strong>{entry.scene.analysis.editorialScore.toFixed(1)}</strong>
                <span>{trendGlyph(entry.trend)} {formatCoordinates(entry.scene.latitude, entry.scene.longitude)}</span>
              </div>
              <FavoriteButton sceneId={entry.scene.id} label={locale === "en" ? "Save scene" : "收藏场景"} />
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

function formatTimeLabel(iso: string, locale: Locale) {
  return new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(new Date(iso));
}
