import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { ScenePlayerPanel } from "@/components/scene-player-panel";
import { ScoreBreakdown } from "@/components/score-breakdown";
import { ScoreChart } from "@/components/score-chart";
import { SimilarScenes } from "@/components/similar-scenes";
import { SiteHeader } from "@/components/site-header";
import { getAllScenes, getSceneBySlug } from "@/lib/data";
import { channelLabel, formatCoordinates, formatTime } from "@/lib/format";
import { copy, isLocale } from "@/lib/i18n";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) return {};
  const scene = await getSceneBySlug(slug);
  if (!scene) return {};
  return {
    title: `${scene.city}, ${scene.country}`,
    description: scene.analysis.reason[locale],
  };
}

export default async function ScenePage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  const [scene, allScenes] = await Promise.all([getSceneBySlug(slug), getAllScenes()]);
  if (!scene) notFound();
  const t = copy[locale];
  const similar = allScenes
    .filter((candidate) => candidate.id !== scene.id && candidate.channels.some((channel) => scene.channels.includes(channel)))
    .slice(0, 3);

  return (
    <>
      <SiteHeader locale={locale} />
      <main className="scene-page" id="main-content">
        <div className="scene-back-row">
          <Link href={`/${locale}`}><ArrowLeft aria-hidden="true" size={15} /> Earth Top Now</Link>
          <span>{formatCoordinates(scene.latitude, scene.longitude)}</span>
        </div>

        <section className="scene-hero">
          <ScenePlayerPanel scene={scene} locale={locale} />
          <div className="scene-intro">
            <p className="eyebrow">{channelLabel(scene.primaryChannel, locale)} · {scene.country}</p>
            <h1>{scene.city}</h1>
            <p className="scene-title">{scene.title[locale]}</p>
            <div className="scene-score-lockup">
              <strong>{scene.analysis.editorialScore.toFixed(1)}</strong>
              <span>{t.score}<br />Top signal</span>
            </div>
            <div className="scene-director-note">
              <p>{t.why}</p>
              <blockquote>{scene.analysis.reason[locale]}</blockquote>
              <span>{Math.round(scene.analysis.confidence * 100)}% {t.confidence.toLowerCase()}</span>
            </div>
          </div>
        </section>

        <section className="scene-dossier">
          <div className="dossier-heading">
            <p className="eyebrow">Live dossier · {formatTime(scene.analysis.observedAt, locale, scene.timezone)}</p>
            <h2>{locale === "en" ? "What the director sees" : "导演看见了什么"}</h2>
          </div>
          <div className="dossier-grid">
            <article>
              <h3>{t.editorial}</h3>
              <ScoreBreakdown scores={scene.analysis.breakdown} locale={locale} />
            </article>
            <article className="condition-panel">
              <h3>{t.conditions}</h3>
              <dl>
                <div><dt>{locale === "en" ? "Temperature" : "温度"}</dt><dd>{scene.analysis.weather.temperatureC}°C</dd></div>
                <div><dt>{locale === "en" ? "Wind" : "风速"}</dt><dd>{scene.analysis.weather.windKph} km/h</dd></div>
                <div><dt>{locale === "en" ? "Rain" : "降水"}</dt><dd>{scene.analysis.weather.precipitationMm} mm</dd></div>
                <div><dt>{locale === "en" ? "Cloud" : "云量"}</dt><dd>{scene.analysis.weather.cloudCoverPercent}%</dd></div>
              </dl>
              <p>Weather data · Open-Meteo</p>
            </article>
            <article className="camera-panel">
              <h3>{t.camera}</h3>
              <p>{scene.media.attribution.name}</p>
              <p>{scene.health.bitrateKbps.toLocaleString()} kbps · {scene.health.latencyMs} ms</p>
              <a href={scene.media.attribution.url} rel="noreferrer" target="_blank">
                Source attribution <ExternalLink aria-hidden="true" size={13} />
              </a>
            </article>
          </div>
        </section>

        <section className="history-section">
          <div>
            <p className="eyebrow">{t.history}</p>
            <h2>{locale === "en" ? "A scene gathering momentum" : "一幕正在积蓄势能"}</h2>
          </div>
          <ScoreChart points={scene.scoreHistory} locale={locale} />
        </section>

        {similar.length > 0 ? (
          <section className="similar-section">
            <p className="eyebrow">{t.similar}</p>
            <SimilarScenes scenes={similar} locale={locale} />
          </section>
        ) : null}
      </main>
    </>
  );
}
