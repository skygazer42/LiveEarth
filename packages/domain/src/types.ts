export const CHANNELS = ["earth", "storm", "ocean", "night"] as const;
export const SCENE_CHANNELS = ["earth", "storm", "ocean", "night"] as const;
export const LOCALES = ["en", "zh"] as const;

export type Channel = (typeof CHANNELS)[number];
export type SceneChannel = (typeof SCENE_CHANNELS)[number];
export type Locale = (typeof LOCALES)[number];
export type LocalizedText = Record<Locale, string>;

export type StreamState = "live" | "degraded" | "offline";
export type StreamKind = "hls" | "dash" | "mp4" | "youtube" | "image";
export type StreamMode = "live" | "near-live";

export interface Attribution {
  name: string;
  url: string;
}

export interface StreamMedia {
  kind: StreamKind;
  mode?: StreamMode;
  posterUrl: string;
  playbackUrl?: string;
  audio: boolean;
  demoOnly: boolean;
  refreshIntervalSeconds?: number;
  maxFrameAgeSeconds?: number;
  fit?: "cover" | "contain";
  attribution: Attribution;
}

export interface StreamHealth {
  state: StreamState;
  checkedAt: string;
  lastFrameAt: string;
  latencyMs: number;
  bitrateKbps: number;
  consecutiveFailures: number;
  flags: Array<"black" | "frozen" | "blurred" | "silent" | "low-bitrate">;
}

export interface ScoreBreakdown {
  visualImpact: number;
  eventIntensity: number;
  motion: number;
  visibility: number;
  technicalQuality: number;
  rarity: number;
}

export interface WeatherEvidence {
  observedAt: string;
  weatherCode: number;
  temperatureC: number;
  windKph: number;
  precipitationMm: number;
  cloudCoverPercent: number;
  source: "open-meteo" | "operator" | "none";
}

export interface SceneAnalysis {
  method?: "vision" | "source-metadata";
  observedAt: string;
  expiresAt: string;
  channelScore: number;
  editorialScore: number;
  breakdown: ScoreBreakdown;
  labels: string[];
  reason: LocalizedText;
  confidence: number;
  evidence: string[];
  weather: WeatherEvidence;
}

export interface ScorePoint {
  at: string;
  score: number;
}

export interface Scene {
  id: string;
  slug: string;
  city: string;
  region: string;
  country: string;
  countryCode: string;
  latitude: number;
  longitude: number;
  timezone: string;
  title: LocalizedText;
  primaryChannel: SceneChannel;
  channels: SceneChannel[];
  media: StreamMedia;
  health: StreamHealth;
  analysis: SceneAnalysis;
  scoreHistory: ScorePoint[];
}

export type RankTrend = "up" | "down" | "steady" | "new";

export interface RankingEntry {
  rank: number;
  previousRank: number | null;
  trend: RankTrend;
  scene: Scene;
}

export interface RankingSnapshot {
  channel: Channel;
  rankingVersion: string;
  generatedAt: string;
  nextRefreshAt: string;
  entries: RankingEntry[];
  isDemo: boolean;
}

export interface GlobePoint {
  sceneId: string;
  slug: string;
  latitude: number;
  longitude: number;
  channel: SceneChannel;
  rank: number;
  score: number;
  label: string;
  state: StreamState;
}

export interface FeedRegistration {
  name: string;
  slug: string;
  city: string;
  region: string;
  country: string;
  countryCode: string;
  title: LocalizedText;
  sourceUrl: string;
  sourceProtocol: "srt" | "rtmps" | "rtsp" | "hls";
  playbackUrl: string;
  posterUrl: string;
  latitude: number;
  longitude: number;
  timezone: string;
  primaryChannel: SceneChannel;
  channels: SceneChannel[];
  attribution: Attribution;
  rightsExpiresAt: string;
  allowAudio: boolean;
  allowTranscoding: boolean;
  allowFrameAnalysis: boolean;
  allowDerivedMetadata: boolean;
  maxRetentionHours: number;
}

export interface StreamProbeResult {
  ok: boolean;
  checkedAt: string;
  latencyMs: number;
  bitrateKbps: number;
  width: number;
  height: number;
  videoCodec: string | null;
  audioCodec: string | null;
  flags: StreamHealth["flags"];
  error?: string;
}
