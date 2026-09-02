import type { Locale, RankTrend, SceneChannel } from "@liveearth/domain/types";

export function formatTime(iso: string, locale: Locale, timezone?: string): string {
  return new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: timezone,
    hour12: locale === "en",
  }).format(new Date(iso));
}

export function formatCoordinates(latitude: number, longitude: number): string {
  const lat = `${Math.abs(latitude).toFixed(2)}°${latitude >= 0 ? "N" : "S"}`;
  const lng = `${Math.abs(longitude).toFixed(2)}°${longitude >= 0 ? "E" : "W"}`;
  return `${lat}  ${lng}`;
}

export function channelLabel(channel: SceneChannel, locale: Locale): string {
  const labels = {
    en: { earth: "Earth", storm: "Storm", ocean: "Ocean", night: "Night" },
    zh: { earth: "地球", storm: "风暴", ocean: "海洋", night: "夜色" },
  } as const;
  return labels[locale][channel];
}

export function trendGlyph(trend: RankTrend): string {
  if (trend === "up") return "↑";
  if (trend === "down") return "↓";
  if (trend === "new") return "•";
  return "—";
}
