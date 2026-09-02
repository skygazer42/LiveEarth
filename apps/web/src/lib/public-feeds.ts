import "server-only";

import { cache } from "react";
import type { Dispatcher } from "undici";
import { isSceneEligible, rankScenes } from "@liveearth/domain/ranking";
import { isAfterCivilDusk, solarAltitudeDegrees } from "@liveearth/domain/solar";
import type {
  Channel,
  LocalizedText,
  RankingSnapshot,
  Scene,
  SceneChannel,
  StreamKind,
} from "@liveearth/domain/types";
import { getOutboundProxyDispatcher } from "@/lib/outbound-proxy";

type NextFetchInit = RequestInit & {
  dispatcher?: Dispatcher;
  next?: { revalidate: number };
};

interface AssetProbe {
  checkedAt: string;
  lastModifiedAt: string;
  latencyMs: number;
  contentLength: number;
}

interface PublicSceneInput {
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
  kind: StreamKind;
  mode: "live" | "near-live";
  posterUrl: string;
  playbackUrl?: string;
  audio: boolean;
  refreshIntervalSeconds: number;
  maxFrameAgeSeconds?: number;
  fit?: "cover" | "contain";
  attribution: { name: string; url: string };
  checkedAt: string;
  capturedAt: string;
  latencyMs: number;
  contentLength?: number;
  score: number;
  labels: string[];
  reason: LocalizedText;
  confidence: number;
  evidence: string[];
}

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
const SOURCE_TIMEOUT_MS = 8_000;
const MAX_CONCURRENT_SOURCE_REQUESTS = 6;
let availableSourceRequestSlots = MAX_CONCURRENT_SOURCE_REQUESTS;
const sourceRequestWaiters: Array<() => void> = [];

async function acquireSourceRequestSlot(): Promise<void> {
  if (availableSourceRequestSlots > 0) {
    availableSourceRequestSlots -= 1;
    return;
  }
  await new Promise<void>((resolve) => sourceRequestWaiters.push(resolve));
}

function releaseSourceRequestSlot(): void {
  const next = sourceRequestWaiters.shift();
  if (next) {
    next();
    return;
  }
  availableSourceRequestSlots = Math.min(
    MAX_CONCURRENT_SOURCE_REQUESTS,
    availableSourceRequestSlots + 1,
  );
}

async function fetchWithTimeout(
  url: string,
  init: NextFetchInit = {},
  timeoutMs = SOURCE_TIMEOUT_MS,
): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    await acquireSourceRequestSlot();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const dispatcher = getOutboundProxyDispatcher();
      const requestInit: NextFetchInit = {
        ...init,
        ...(dispatcher ? { dispatcher } : {}),
        signal: controller.signal,
      };
      const response = await fetch(url, requestInit);
      if ((init.method ?? "GET").toUpperCase() === "HEAD") return response;
      const body = await response.arrayBuffer();
      return new Response(body.byteLength > 0 ? body : null, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });
    } catch (error) {
      lastError = error;
      if (controller.signal.aborted || attempt === 1) throw error;
    } finally {
      clearTimeout(timer);
      releaseSourceRequestSlot();
    }
  }
  throw lastError;
}

async function fetchJson<T>(url: string, init: NextFetchInit): Promise<T> {
  const response = await fetchWithTimeout(url, init);
  if (!response.ok) throw new Error(`Source returned ${response.status}`);
  return (await response.json()) as T;
}

async function fetchArrayBuffer(url: string, init: NextFetchInit): Promise<ArrayBuffer> {
  const response = await fetchWithTimeout(url, init);
  if (!response.ok) throw new Error(`Source returned ${response.status}`);
  return response.arrayBuffer();
}

async function probeAsset(
  url: string,
  expectedType?: string,
  revalidateSeconds = 30,
): Promise<AssetProbe> {
  const startedAt = Date.now();
  const response = await fetchWithTimeout(url, {
    method: "HEAD",
    redirect: "follow",
    next: { revalidate: revalidateSeconds },
  });
  if (!response.ok) throw new Error(`Asset returned ${response.status}`);
  const contentType = response.headers.get("content-type") ?? "";
  if (expectedType && !contentType.startsWith(expectedType)) {
    throw new Error(`Unexpected asset type ${contentType}`);
  }
  const checkedAt = new Date().toISOString();
  const modifiedHeader = response.headers.get("last-modified");
  const modifiedTime = modifiedHeader ? new Date(modifiedHeader).getTime() : Number.NaN;
  return {
    checkedAt,
    lastModifiedAt: Number.isFinite(modifiedTime)
      ? new Date(modifiedTime).toISOString()
      : checkedAt,
    latencyMs: Date.now() - startedAt,
    contentLength: Number(response.headers.get("content-length") ?? 0) || 0,
  };
}

function versionedUrl(url: string, capturedAt: string): string {
  const parsed = new URL(url);
  parsed.searchParams.set("liveearth_v", String(Math.floor(new Date(capturedAt).getTime() / 60_000)));
  return parsed.toString();
}

function currentPlaceChannel(
  at: Date,
  latitude: number,
  longitude: number,
): { primaryChannel: SceneChannel; channels: SceneChannel[] } {
  if (isAfterCivilDusk(at, latitude, longitude)) {
    return { primaryChannel: "night", channels: ["earth", "night"] };
  }
  return { primaryChannel: "earth", channels: ["earth"] };
}

function publicScene(input: PublicSceneInput): Scene {
  const bitrateKbps = input.contentLength
    ? Math.round((input.contentLength * 8) / Math.max(1, input.refreshIntervalSeconds) / 1_000)
    : 0;
  const motion = input.kind === "youtube" ? 96 : input.kind === "mp4" ? 78 : 42;
  const technicalQuality = input.kind === "youtube" ? 90 : input.kind === "image" ? 72 : 76;
  const breakdown = {
    visualImpact: input.score,
    eventIntensity: Math.max(45, input.score - 18),
    motion,
    visibility: Math.min(94, input.score + 3),
    technicalQuality,
    rarity: Math.max(48, input.score - 12),
  };
  return {
    id: input.id,
    slug: input.slug,
    city: input.city,
    region: input.region,
    country: input.country,
    countryCode: input.countryCode,
    latitude: input.latitude,
    longitude: input.longitude,
    timezone: input.timezone,
    title: input.title,
    primaryChannel: input.primaryChannel,
    channels: input.channels,
    media: {
      kind: input.kind,
      mode: input.mode,
      posterUrl: input.posterUrl,
      ...(input.playbackUrl ? { playbackUrl: input.playbackUrl } : {}),
      audio: input.audio,
      demoOnly: false,
      refreshIntervalSeconds: input.refreshIntervalSeconds,
      ...(input.maxFrameAgeSeconds
        ? { maxFrameAgeSeconds: input.maxFrameAgeSeconds }
        : {}),
      ...(input.fit ? { fit: input.fit } : {}),
      attribution: input.attribution,
    },
    health: {
      state: "live",
      checkedAt: input.checkedAt,
      lastFrameAt: input.capturedAt,
      latencyMs: input.latencyMs,
      bitrateKbps,
      consecutiveFailures: 0,
      flags: [],
    },
    analysis: {
      method: "source-metadata",
      observedAt: input.checkedAt,
      expiresAt: new Date(new Date(input.checkedAt).getTime() + 10 * 60_000).toISOString(),
      channelScore: input.score,
      editorialScore: input.score,
      breakdown,
      labels: input.labels,
      reason: input.reason,
      confidence: input.confidence,
      evidence: input.evidence,
      weather: {
        observedAt: input.checkedAt,
        weatherCode: 0,
        temperatureC: 0,
        windKph: 0,
        precipitationMm: 0,
        cloudCoverPercent: 0,
        source: "none",
      },
    },
    scoreHistory: [{ at: input.checkedAt, score: input.score }],
  };
}

interface IssPosition {
  latitude?: number;
  longitude?: number;
  altitude?: number;
  timestamp?: number;
}

async function currentIssPosition(): Promise<{
  latitude: number;
  longitude: number;
  evidence: string;
}> {
  try {
    const position = await fetchJson<IssPosition>(
      "https://api.wheretheiss.at/v1/satellites/25544",
      { next: { revalidate: 30 } },
    );
    if (typeof position.latitude !== "number" || typeof position.longitude !== "number") {
      throw new Error("ISS position was incomplete");
    }
    const altitude = typeof position.altitude === "number" ? Math.round(position.altitude) : null;
    return {
      latitude: position.latitude,
      longitude: position.longitude,
      evidence: `Moving ISS position from wheretheiss.at${altitude ? ` · ${altitude} km altitude` : ""}`,
    };
  } catch {
    return {
      latitude: 0,
      longitude: 0,
      evidence: "ISS position is moving; the globe marker is a fallback when position telemetry is unavailable",
    };
  }
}

async function isEmbeddableLiveYoutube(videoId: string): Promise<boolean> {
  if (!YOUTUBE_ID.test(videoId)) return false;
  try {
    const response = await fetchWithTimeout(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: { "Accept-Language": "en-US,en;q=0.8" },
      next: { revalidate: 120 },
    }, 6_000);
    if (!response.ok) return false;
    const html = await response.text();
    return html.includes('"isLiveNow":true') && html.includes('"playableInEmbed":true');
  } catch {
    return false;
  }
}

const EXTRA_OCEAN_YOUTUBE_FEEDS = [
  {
    id: "nazare-waves",
    slug: "nazare-waves-live",
    videoId: "_Gi8UC_HPKM",
    city: "Nazaré",
    region: "Leiria coast",
    country: "Portugal",
    countryCode: "PT",
    latitude: 39.6012,
    longitude: -9.0701,
    timezone: "Europe/Lisbon",
    title: {
      en: "Live Atlantic swell from Nazaré's ocean camera",
      zh: "纳扎雷海岸摄像机传回的大西洋涌浪直播",
    },
    attributionUrl: "https://explore.org/livecams/currently-live/nazare",
    labels: ["Atlantic", "waves", "coast"],
    score: 89,
  },
  {
    id: "utopia-reef",
    slug: "utopia-reef-live",
    videoId: "1zcIUk66HX4",
    city: "Utila",
    region: "Utopia Village reef, Bay Islands",
    country: "Honduras",
    countryCode: "HN",
    latitude: 16.0723,
    longitude: -86.9514,
    timezone: "America/Tegucigalpa",
    title: {
      en: "Live underwater reef view from Utopia Village",
      zh: "乌托邦村水下珊瑚礁实时画面",
    },
    attributionUrl: "https://explore.org/livecams/oceans/utopia-village-multi-cams",
    labels: ["underwater", "reef", "Honduras"],
    score: 88,
  },
  {
    id: "santa-monica-beach",
    slug: "santa-monica-beach-live",
    videoId: "v97JpT3ZA0w",
    city: "Santa Monica",
    region: "Santa Monica Beach and Pier",
    country: "United States",
    countryCode: "US",
    latitude: 34.0094,
    longitude: -118.4973,
    timezone: "America/Los_Angeles",
    title: {
      en: "Live Pacific surf and pier view from Santa Monica",
      zh: "圣莫尼卡太平洋海浪与码头直播",
    },
    attributionUrl: "https://explore.org/livecams/currently-live/santa-monica-beach-cam",
    labels: ["Pacific", "surf", "beach"],
    score: 87,
  },
  {
    id: "homosassa-manatee",
    slug: "homosassa-manatee-live",
    videoId: "Fz6sl9YJZE0",
    city: "Homosassa",
    region: "Homosassa Springs",
    country: "United States",
    countryCode: "US",
    latitude: 28.7997,
    longitude: -82.5898,
    timezone: "America/New_York",
    title: {
      en: "Live underwater manatee camera at Homosassa Springs",
      zh: "霍莫萨萨泉水下海牛实时摄像机",
    },
    attributionUrl:
      "https://explore.org/livecams/manatees/homosassa-springs-underwater-manatees",
    labels: ["underwater", "manatee", "spring"],
    score: 86,
  },
  {
    id: "orcalab-underwater",
    slug: "orcalab-underwater-live",
    videoId: "HVzyLMktOVo",
    city: "Hanson Island",
    region: "OrcaLab rubbing beach",
    country: "Canada",
    countryCode: "CA",
    latitude: 50.575,
    longitude: -126.719,
    timezone: "America/Vancouver",
    title: {
      en: "Live underwater OrcaLab rubbing-beach camera",
      zh: "OrcaLab 鲸类擦身海滩水下直播",
    },
    attributionUrl:
      "https://explore.org/livecams/orcas/orcalab-rubbing-beach-underwater",
    labels: ["underwater", "orca habitat", "British Columbia"],
    score: 85,
  },
  {
    id: "anacapa-kelp",
    slug: "anacapa-kelp-forest-live",
    videoId: "OAJF1Ie1m_Q",
    city: "Anacapa Island",
    region: "Channel Islands National Park",
    country: "United States",
    countryCode: "US",
    latitude: 34.0158,
    longitude: -119.367,
    timezone: "America/Los_Angeles",
    title: {
      en: "Live kelp-forest ocean camera at Anacapa Island",
      zh: "阿纳卡帕岛海藻森林海洋实时摄像机",
    },
    attributionUrl:
      "https://explore.org/livecams/channel-islands-national-park/channel-islands-national-park-anacapa-ocean",
    labels: ["kelp forest", "marine park", "underwater"],
    score: 84,
  },
  {
    id: "utopia-sandy-channel",
    slug: "utopia-sandy-channel-live",
    videoId: "jzx_n25g3kA",
    city: "Utila",
    region: "Utopia Village sandy reef channel",
    country: "Honduras",
    countryCode: "HN",
    latitude: 16.0723,
    longitude: -86.9514,
    timezone: "America/Tegucigalpa",
    title: {
      en: "Live underwater view along Utopia Village's sandy reef channel",
      zh: "乌托邦村沙质礁道水下实时画面",
    },
    attributionUrl:
      "https://explore.org/livecams/utopia-village/utopia-village-reef-channel",
    labels: ["underwater", "reef channel", "Honduras"],
    score: 83,
  },
  {
    id: "catalina-harbor",
    slug: "catalina-harbor-live",
    videoId: "2yx7RKxpyzQ",
    city: "Two Harbors",
    region: "Santa Catalina Island",
    country: "United States",
    countryCode: "US",
    latitude: 33.442,
    longitude: -118.498,
    timezone: "America/Los_Angeles",
    title: {
      en: "Live ocean and coastline view across Catalina Harbor",
      zh: "卡特琳娜港海面与海岸线实时画面",
    },
    attributionUrl: "https://explore.org/livecams/currently-live/catalina-harbor-cam",
    labels: ["Pacific", "harbor", "coastline"],
    score: 82,
  },
] as const;

async function youtubeLiveScenes(): Promise<Scene[]> {
  const earthVideoId = process.env.LIVE_EARTH_YOUTUBE_EARTH_VIDEO_ID ?? "fO9e9jnhYK8";
  const oceanVideoId = process.env.LIVE_EARTH_YOUTUBE_OCEAN_VIDEO_ID ?? "DHUnz4dyb54";
  const sharkVideoId = process.env.LIVE_EARTH_YOUTUBE_SHARK_VIDEO_ID ?? "YT7lH6U68S4";
  const [liveStates, issPosition] = await Promise.all([
    Promise.all(
      [earthVideoId, oceanVideoId, sharkVideoId, ...EXTRA_OCEAN_YOUTUBE_FEEDS.map((feed) => feed.videoId)]
        .map((videoId) => isEmbeddableLiveYoutube(videoId)),
    ),
    currentIssPosition(),
  ]);
  const [earthLive, oceanLive, sharkLive, ...extraOceanLive] = liveStates;
  const checkedAt = new Date().toISOString();
  const scenes: Scene[] = [];

  if (earthLive) {
    scenes.push(
      publicScene({
        id: "public-youtube-iss-earth",
        slug: "iss-earth-live",
        city: "Low Earth Orbit",
        region: "International Space Station",
        country: "International",
        countryCode: "XX",
        latitude: issPosition.latitude,
        longitude: issPosition.longitude,
        timezone: "UTC",
        title: {
          en: "Live 4K Earth view from cameras aboard the International Space Station",
          zh: "国际空间站摄像机传回的 4K 地球实时画面",
        },
        primaryChannel: "earth",
        channels: ["earth"],
        kind: "youtube",
        mode: "live",
        posterUrl: `https://i.ytimg.com/vi/${earthVideoId}/maxresdefault_live.jpg`,
        playbackUrl: `https://www.youtube-nocookie.com/embed/${earthVideoId}?autoplay=1&playsinline=1&rel=0`,
        audio: true,
        refreshIntervalSeconds: 30,
        fit: "contain",
        attribution: {
          name: "Sen ISS livestream · embedded with the YouTube player",
          url: `https://www.youtube.com/watch?v=${earthVideoId}`,
        },
        checkedAt,
        capturedAt: checkedAt,
        latencyMs: 0,
        score: 94,
        labels: ["continuous live", "Earth", "ISS", "operator player"],
        reason: {
          en: "The operator's original YouTube player reports a currently live, embeddable 4K view from orbit.",
          zh: "运营方的 YouTube 原始播放器当前报告为直播且允许嵌入，画面来自轨道上的 4K 摄像机。",
        },
        confidence: 0.99,
        evidence: [
          "YouTube watch metadata: isLiveNow=true",
          "YouTube watch metadata: playableInEmbed=true",
          issPosition.evidence,
          "Stream is embedded only; LiveEarth does not download, proxy, or record it",
        ],
      }),
    );
  }

  if (oceanLive) {
    scenes.push(
      publicScene({
        id: "public-youtube-tropical-reef",
        slug: "tropical-reef-live",
        city: "Long Beach",
        region: "Aquarium of the Pacific",
        country: "United States",
        countryCode: "US",
        latitude: 33.7629,
        longitude: -118.196,
        timezone: "America/Los_Angeles",
        title: {
          en: "Tropical reef camera, streamed continuously by Aquarium of the Pacific and explore.org",
          zh: "由太平洋水族馆与 explore.org 持续播出的热带珊瑚礁直播",
        },
        primaryChannel: "ocean",
        channels: ["ocean"],
        kind: "youtube",
        mode: "live",
        posterUrl: `https://i.ytimg.com/vi/${oceanVideoId}/maxresdefault_live.jpg`,
        playbackUrl: `https://www.youtube-nocookie.com/embed/${oceanVideoId}?autoplay=1&playsinline=1&rel=0`,
        audio: true,
        refreshIntervalSeconds: 30,
        fit: "contain",
        attribution: {
          name: "Aquarium of the Pacific / explore.org · YouTube embed",
          url: "https://explore.org/livecams/aquarium-of-the-pacific/pacific-aquarium-tropical-reef-camera",
        },
        checkedAt,
        capturedAt: checkedAt,
        latencyMs: 0,
        score: 91,
        labels: ["continuous live", "tropical reef", "ocean", "operator player"],
        reason: {
          en: "The camera's original YouTube player is live and explicitly permits embedding without extracting the stream.",
          zh: "该镜头的 YouTube 原始播放器当前正在直播并明确允许嵌入，项目没有提取视频流。",
        },
        confidence: 0.99,
        evidence: [
          "YouTube watch metadata: isLiveNow=true",
          "YouTube watch metadata: playableInEmbed=true",
          "Stream is embedded only; LiveEarth does not download, proxy, or record it",
        ],
      }),
    );
  }

  if (sharkLive) {
    scenes.push(
      publicScene({
        id: "public-youtube-shark-lagoon",
        slug: "shark-lagoon-live",
        city: "Long Beach",
        region: "Aquarium of the Pacific · Shark Lagoon",
        country: "United States",
        countryCode: "US",
        latitude: 33.7629,
        longitude: -118.196,
        timezone: "America/Los_Angeles",
        title: {
          en: "Sharks and rays circling the Aquarium of the Pacific lagoon live",
          zh: "太平洋水族馆鲨鱼与鳐鱼环游礁湖实时直播",
        },
        primaryChannel: "ocean",
        channels: ["ocean"],
        kind: "youtube",
        mode: "live",
        posterUrl: `https://i.ytimg.com/vi/${sharkVideoId}/maxresdefault_live.jpg`,
        playbackUrl: `https://www.youtube-nocookie.com/embed/${sharkVideoId}?autoplay=1&playsinline=1&rel=0`,
        audio: true,
        refreshIntervalSeconds: 30,
        fit: "contain",
        attribution: {
          name: "Aquarium of the Pacific / explore.org · YouTube embed",
          url: "https://explore.org/livecams/currently-live/shark-lagoon-cam",
        },
        checkedAt,
        capturedAt: checkedAt,
        latencyMs: 0,
        score: 90,
        labels: ["continuous live", "sharks", "rays", "ocean", "operator player"],
        reason: {
          en: "The Shark Lagoon operator player is currently live and permits its original YouTube embed without stream extraction.",
          zh: "鲨鱼礁湖运营方播放器当前正在直播，并允许使用 YouTube 原始嵌入；项目没有提取视频流。",
        },
        confidence: 0.99,
        evidence: [
          "YouTube watch metadata: isLiveNow=true",
          "YouTube watch metadata: playableInEmbed=true",
          "Explore.org lists Shark Lagoon as currently live",
          "Stream is embedded only; LiveEarth does not download, proxy, or record it",
        ],
      }),
    );
  }

  EXTRA_OCEAN_YOUTUBE_FEEDS.forEach((feed, index) => {
    if (!extraOceanLive[index]) return;
    scenes.push(
      publicScene({
        id: `public-youtube-${feed.id}`,
        slug: feed.slug,
        city: feed.city,
        region: feed.region,
        country: feed.country,
        countryCode: feed.countryCode,
        latitude: feed.latitude,
        longitude: feed.longitude,
        timezone: feed.timezone,
        title: feed.title,
        primaryChannel: "ocean",
        channels: ["ocean"],
        kind: "youtube",
        mode: "live",
        posterUrl: `https://i.ytimg.com/vi/${feed.videoId}/maxresdefault_live.jpg`,
        playbackUrl: `https://www.youtube-nocookie.com/embed/${feed.videoId}?autoplay=1&playsinline=1&rel=0`,
        audio: true,
        refreshIntervalSeconds: 60,
        fit: "contain",
        attribution: {
          name: "explore.org partner camera · YouTube embed",
          url: feed.attributionUrl,
        },
        checkedAt,
        capturedAt: checkedAt,
        latencyMs: 0,
        score: feed.score,
        labels: ["continuous live", "ocean", "operator player", ...feed.labels],
        reason: {
          en: "The operator's original YouTube player reports this ocean camera as currently live and embeddable; LiveEarth does not extract the stream.",
          zh: "运营方的 YouTube 原始播放器报告该海洋摄像机当前正在直播且允许嵌入；LiveEarth 不提取视频流。",
        },
        confidence: 0.99,
        evidence: [
          "YouTube watch metadata: isLiveNow=true",
          "YouTube watch metadata: playableInEmbed=true",
          "Stream is embedded only; LiveEarth does not download, proxy, or record it",
        ],
      }),
    );
  });

  return scenes;
}

const NOAA_FEEDS = [
  {
    id: "goes-east",
    satellite: "GOES-19",
    longitude: -75.2,
    url: "https://cdn.star.nesdis.noaa.gov/GOES19/ABI/FD/GEOCOLOR/1808x1808.jpg",
    sourceUrl: "https://www.star.nesdis.noaa.gov/goes/fulldisk_band.php?band=GEOCOLOR&dim=1&length=240&sat=G19",
  },
  {
    id: "goes-west",
    satellite: "GOES-18",
    longitude: -137.2,
    url: "https://cdn.star.nesdis.noaa.gov/GOES18/ABI/FD/GEOCOLOR/1808x1808.jpg",
    sourceUrl: "https://www.star.nesdis.noaa.gov/goes/fulldisk_band.php?band=GEOCOLOR&dim=1&length=240&sat=G18",
  },
] as const;

const NOAA_LOOP_FEEDS = [
  {
    id: "caribbean-loop",
    satellite: "GOES-19",
    city: "Caribbean",
    region: "San Juan weather satellite sector",
    latitude: 18.4655,
    longitude: -66.1057,
    timezone: "America/Puerto_Rico",
    posterUrl: "https://cdn.star.nesdis.noaa.gov/WFO/sju/GEOCOLOR/latest.jpg",
    playbackUrl:
      "https://cdn.star.nesdis.noaa.gov/WFO/sju/GEOCOLOR/GOES19-SJU-GEOCOLOR-600x600.mp4",
    sourceUrl: "https://cdn.star.nesdis.noaa.gov/WFO/sju/GEOCOLOR/",
  },
  {
    id: "south-florida-loop",
    satellite: "GOES-19",
    city: "South Florida",
    region: "Miami weather satellite sector",
    latitude: 25.7617,
    longitude: -80.1918,
    timezone: "America/New_York",
    posterUrl: "https://cdn.star.nesdis.noaa.gov/WFO/mfl/GEOCOLOR/latest.jpg",
    playbackUrl:
      "https://cdn.star.nesdis.noaa.gov/WFO/mfl/GEOCOLOR/GOES19-MFL-GEOCOLOR-600x600.mp4",
    sourceUrl: "https://cdn.star.nesdis.noaa.gov/WFO/mfl/GEOCOLOR/",
  },
  {
    id: "hawaii-loop",
    satellite: "GOES-18",
    city: "Hawaiʻi",
    region: "Honolulu weather satellite sector",
    latitude: 21.3099,
    longitude: -157.8581,
    timezone: "Pacific/Honolulu",
    posterUrl: "https://cdn.star.nesdis.noaa.gov/WFO/hfo/GEOCOLOR/latest.jpg",
    playbackUrl:
      "https://cdn.star.nesdis.noaa.gov/WFO/hfo/GEOCOLOR/GOES18-HFO-GEOCOLOR-600x600.mp4",
    sourceUrl: "https://cdn.star.nesdis.noaa.gov/WFO/hfo/GEOCOLOR/",
  },
  {
    id: "gulf-coast-loop",
    satellite: "GOES-19",
    city: "Gulf Coast",
    region: "Mobile weather satellite sector",
    latitude: 30.6954,
    longitude: -88.0399,
    timezone: "America/Chicago",
    posterUrl: "https://cdn.star.nesdis.noaa.gov/WFO/mob/GEOCOLOR/latest.jpg",
    playbackUrl:
      "https://cdn.star.nesdis.noaa.gov/WFO/mob/GEOCOLOR/GOES19-MOB-GEOCOLOR-600x600.mp4",
    sourceUrl: "https://cdn.star.nesdis.noaa.gov/WFO/mob/GEOCOLOR/",
  },
  {
    id: "northeast-loop",
    satellite: "GOES-19",
    city: "Northeast",
    region: "Caribou weather satellite sector",
    latitude: 46.8606,
    longitude: -68.012,
    timezone: "America/New_York",
    posterUrl: "https://cdn.star.nesdis.noaa.gov/WFO/car/GEOCOLOR/latest.jpg",
    playbackUrl:
      "https://cdn.star.nesdis.noaa.gov/WFO/car/GEOCOLOR/GOES19-CAR-GEOCOLOR-600x600.mp4",
    sourceUrl: "https://cdn.star.nesdis.noaa.gov/WFO/car/GEOCOLOR/",
  },
  {
    id: "pacific-northwest-loop",
    satellite: "GOES-18",
    city: "Pacific Northwest",
    region: "Seattle weather satellite sector",
    latitude: 47.6062,
    longitude: -122.3321,
    timezone: "America/Los_Angeles",
    posterUrl: "https://cdn.star.nesdis.noaa.gov/WFO/sew/GEOCOLOR/latest.jpg",
    playbackUrl:
      "https://cdn.star.nesdis.noaa.gov/WFO/sew/GEOCOLOR/GOES18-SEW-GEOCOLOR-600x600.mp4",
    sourceUrl: "https://cdn.star.nesdis.noaa.gov/WFO/sew/GEOCOLOR/",
  },
  {
    id: "southern-california-loop",
    satellite: "GOES-18",
    city: "Southern California",
    region: "Los Angeles weather satellite sector",
    latitude: 34.0522,
    longitude: -118.2437,
    timezone: "America/Los_Angeles",
    posterUrl: "https://cdn.star.nesdis.noaa.gov/WFO/lox/GEOCOLOR/latest.jpg",
    playbackUrl:
      "https://cdn.star.nesdis.noaa.gov/WFO/lox/GEOCOLOR/GOES18-LOX-GEOCOLOR-600x600.mp4",
    sourceUrl: "https://cdn.star.nesdis.noaa.gov/WFO/lox/GEOCOLOR/",
  },
  {
    id: "central-plains-loop",
    satellite: "GOES-18",
    city: "Central Plains",
    region: "Hastings weather satellite sector",
    latitude: 40.5863,
    longitude: -98.3899,
    timezone: "America/Chicago",
    posterUrl: "https://cdn.star.nesdis.noaa.gov/WFO/gid/GEOCOLOR/latest.jpg",
    playbackUrl:
      "https://cdn.star.nesdis.noaa.gov/WFO/gid/GEOCOLOR/GOES18-GID-GEOCOLOR-600x600.mp4",
    sourceUrl: "https://cdn.star.nesdis.noaa.gov/WFO/gid/GEOCOLOR/",
  },
  {
    id: "new-york-metro-loop",
    satellite: "GOES-19",
    city: "New York Metro",
    region: "New York weather satellite sector",
    latitude: 40.7128,
    longitude: -74.006,
    timezone: "America/New_York",
    posterUrl: "https://cdn.star.nesdis.noaa.gov/WFO/okx/GEOCOLOR/latest.jpg",
    playbackUrl:
      "https://cdn.star.nesdis.noaa.gov/WFO/okx/GEOCOLOR/GOES19-OKX-GEOCOLOR-600x600.mp4",
    sourceUrl: "https://cdn.star.nesdis.noaa.gov/WFO/okx/GEOCOLOR/",
  },
  {
    id: "mid-atlantic-loop",
    satellite: "GOES-19",
    city: "Mid-Atlantic",
    region: "Baltimore/Washington weather satellite sector",
    latitude: 38.9072,
    longitude: -77.0369,
    timezone: "America/New_York",
    posterUrl: "https://cdn.star.nesdis.noaa.gov/WFO/lwx/GEOCOLOR/latest.jpg",
    playbackUrl:
      "https://cdn.star.nesdis.noaa.gov/WFO/lwx/GEOCOLOR/GOES19-LWX-GEOCOLOR-600x600.mp4",
    sourceUrl: "https://cdn.star.nesdis.noaa.gov/WFO/lwx/GEOCOLOR/",
  },
  {
    id: "northern-rockies-loop",
    satellite: "GOES-18",
    city: "Northern Rockies",
    region: "Missoula weather satellite sector",
    latitude: 46.8721,
    longitude: -113.994,
    timezone: "America/Denver",
    posterUrl: "https://cdn.star.nesdis.noaa.gov/WFO/mso/GEOCOLOR/latest.jpg",
    playbackUrl:
      "https://cdn.star.nesdis.noaa.gov/WFO/mso/GEOCOLOR/GOES18-MSO-GEOCOLOR-600x600.mp4",
    sourceUrl: "https://cdn.star.nesdis.noaa.gov/WFO/mso/GEOCOLOR/",
  },
] as const;

async function noaaScenes(): Promise<Scene[]> {
  const [imageProbes, loopProbes] = await Promise.all([
    Promise.allSettled(
      NOAA_FEEDS.map(async (feed) => ({
        feed,
        probe: await probeAsset(feed.url, "image/", 300),
      })),
    ),
    Promise.allSettled(
      NOAA_LOOP_FEEDS.map(async (feed) => ({
        feed,
        videoProbe: await probeAsset(feed.playbackUrl, "video/", 300),
      })),
    ),
  ]);
  const imageScenes = imageProbes.flatMap((result) => {
    if (result.status !== "fulfilled") return [];
    const { feed, probe } = result.value;
    return [
      publicScene({
        id: `public-noaa-${feed.id}`,
        slug: `${feed.id}-geocolor`,
        city: feed.satellite,
        region: feed.id === "goes-east" ? "Atlantic full disk" : "Pacific full disk",
        country: "United States",
        countryCode: "US",
        latitude: 0,
        longitude: feed.longitude,
        timezone: "UTC",
        title: {
          en: `${feed.satellite} full-disk GeoColor satellite image`,
          zh: `${feed.satellite} 地球全圆盘 GeoColor 卫星图像`,
        },
        primaryChannel: "storm",
        channels: ["storm"],
        kind: "image",
        mode: "near-live",
        posterUrl: versionedUrl(feed.url, probe.lastModifiedAt),
        audio: false,
        refreshIntervalSeconds: 600,
        fit: "contain",
        attribution: { name: "CIRA/NOAA GeoColor", url: feed.sourceUrl },
        checkedAt: probe.checkedAt,
        capturedAt: probe.lastModifiedAt,
        latencyMs: probe.latencyMs,
        contentLength: probe.contentLength,
        score: feed.id === "goes-east" ? 88 : 87,
        labels: ["near-live", "satellite", "cloud field", "GeoColor"],
        reason: {
          en: "The latest CIRA/NOAA full-disk image passed a freshness and content-type check; it updates about every ten minutes.",
          zh: "最新 CIRA/NOAA 地球全圆盘图像已通过新鲜度与文件类型检查，约每十分钟更新。",
        },
        confidence: 0.98,
        evidence: [
          `Operator file modified ${probe.lastModifiedAt}`,
          "CIRA/NOAA requests credit for GeoColor imagery",
          "Informational imagery only; not for operational forecasting or emergency response",
        ],
      }),
    ];
  });
  const loopScenes = loopProbes.flatMap((result, index) => {
    if (result.status !== "fulfilled") return [];
    const { feed, videoProbe } = result.value;
    return [
      publicScene({
        id: `public-noaa-${feed.id}`,
        slug: `goes-${feed.id}`,
        city: feed.city,
        region: feed.region,
        country: "United States",
        countryCode: "US",
        latitude: feed.latitude,
        longitude: feed.longitude,
        timezone: feed.timezone,
        title: {
          en: `${feed.satellite} latest regional GeoColor satellite loop`,
          zh: `${feed.satellite} 最新区域 GeoColor 卫星动态循环`,
        },
        primaryChannel: "storm",
        channels: ["storm"],
        kind: "mp4",
        mode: "near-live",
        posterUrl: versionedUrl(feed.posterUrl, videoProbe.lastModifiedAt),
        playbackUrl: versionedUrl(feed.playbackUrl, videoProbe.lastModifiedAt),
        audio: false,
        refreshIntervalSeconds: 600,
        maxFrameAgeSeconds: 3_600,
        fit: "contain",
        attribution: { name: "CIRA/NOAA GeoColor", url: feed.sourceUrl },
        checkedAt: videoProbe.checkedAt,
        capturedAt: videoProbe.lastModifiedAt,
        latencyMs: videoProbe.latencyMs,
        contentLength: videoProbe.contentLength,
        score: 92 - index,
        labels: ["near-live loop", "satellite", "cloud motion", "GeoColor"],
        reason: {
          en: "NOAA's latest regional GeoColor MP4 passed freshness and media-type checks, showing recent satellite frames as a moving loop.",
          zh: "NOAA 最新区域 GeoColor MP4 已通过新鲜度与媒体类型检查，以动态循环展示近期卫星帧。",
        },
        confidence: 0.98,
        evidence: [
          `Operator loop modified ${videoProbe.lastModifiedAt}`,
          "This is a time-lapse loop of recent satellite frames, not a continuous camera",
          "CIRA/NOAA requests credit for GeoColor imagery",
          "Informational imagery only; not for operational forecasting or emergency response",
        ],
      }),
    ];
  });
  return [...imageScenes, ...loopScenes];
}

interface NdbcBuoyCamera {
  id?: string;
  name?: string;
  lat?: number;
  lng?: number;
  img?: string | null;
}

function ndbcCapturedAt(filename: string): string | null {
  const match = filename.match(/^[A-Z0-9]+_(\d{4})_(\d{2})_(\d{2})_(\d{2})(\d{2})\.jpg$/i);
  if (!match) return null;
  const [, year, month, day, hour, minute] = match;
  const timestamp = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
  );
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

async function ndbcBuoyCamScenes(): Promise<Scene[]> {
  const cameras = await fetchJson<NdbcBuoyCamera[]>(
    "https://www.ndbc.noaa.gov/buoycams.php",
    { next: { revalidate: 60 } },
  );
  const now = Date.now();
  const candidates = cameras
    .flatMap((camera) => {
      const capturedAt = camera.img ? ndbcCapturedAt(camera.img) : null;
      if (
        !camera.id ||
        !camera.name ||
        !capturedAt ||
        typeof camera.lat !== "number" ||
        typeof camera.lng !== "number"
      ) return [];
      const capturedTime = new Date(capturedAt).getTime();
      if (capturedTime > now + 30_000 || now - capturedTime > 2 * 60 * 60_000) return [];
      const solarAltitude = solarAltitudeDegrees(
        new Date(capturedAt),
        camera.lat,
        camera.lng,
      );
      if (solarAltitude < 0) return [];
      return [{ camera, capturedAt, capturedTime, solarAltitude }];
    })
    .sort(
      (a, b) => b.solarAltitude - a.solarAltitude || b.capturedTime - a.capturedTime,
    )
    .slice(0, 6);
  const results = await Promise.allSettled(
    candidates.map(async ({ camera, capturedAt }) => {
      const imageUrl = `https://www.ndbc.noaa.gov/buoycam.php?station=${encodeURIComponent(camera.id as string)}`;
      return {
        camera,
        capturedAt,
        imageUrl,
        probe: await probeAsset(imageUrl, "image/", 300),
      };
    }),
  );
  return results.flatMap((result, index) => {
    if (result.status !== "fulfilled") return [];
    const { camera, capturedAt, imageUrl, probe } = result.value;
    const stationId = camera.id as string;
    return [
      publicScene({
        id: `public-ndbc-${stationId.toLowerCase()}`,
        slug: `ndbc-buoycam-${stationId.toLowerCase()}`,
        city: `Buoy ${stationId}`,
        region: camera.name as string,
        country: "United States",
        countryCode: "US",
        latitude: camera.lat as number,
        longitude: camera.lng as number,
        timezone: "UTC",
        title: {
          en: `Latest ocean panorama from NDBC station ${stationId}`,
          zh: `NDBC 海洋浮标站 ${stationId} 最新全景`,
        },
        primaryChannel: "ocean",
        channels: ["ocean"],
        kind: "image",
        mode: "near-live",
        posterUrl: versionedUrl(imageUrl, capturedAt),
        audio: false,
        refreshIntervalSeconds: 3_600,
        maxFrameAgeSeconds: 7_200,
        fit: "contain",
        attribution: {
          name: "NOAA National Data Buoy Center (NDBC) BuoyCAM",
          url: `https://www.ndbc.noaa.gov/station_page.php?station=${stationId}`,
        },
        checkedAt: probe.checkedAt,
        capturedAt,
        latencyMs: probe.latencyMs,
        contentLength: probe.contentLength,
        score: 85 - index,
        labels: ["near-live", "ocean", "offshore buoy", "NOAA NDBC"],
        reason: {
          en: "NDBC identifies this as a current daylight BuoyCAM panorama; both its operator timestamp and official latest-image endpoint were checked.",
          zh: "NDBC 将其标识为当前日间 BuoyCAM 全景；项目已核验运营方时间戳及官方最新图像地址。",
        },
        confidence: 0.99,
        evidence: [
          `NDBC image filename timestamp ${capturedAt}`,
          "NDBC documents the buoycam.php endpoint for linking to each station's most recent image",
          "NOAA material is public domain unless otherwise noted; NOAA/NDBC attribution is displayed",
          "BuoyCAMs take periodic photos during daylight and are explicitly labelled near-live",
        ],
      }),
    ];
  });
}

interface HongKongCamera {
  key: string;
  region: string;
  district: string;
  description: string;
  latitude: number;
  longitude: number;
  url: string;
}

function parseHongKongCameraTsv(buffer: ArrayBuffer): HongKongCamera[] {
  const text = new TextDecoder("utf-16le").decode(buffer).replace(/^\uFEFF/, "");
  return text
    .split(/\r?\n/)
    .slice(1)
    .flatMap((line) => {
      if (!line.trim()) return [];
      const cells = line.split("\t");
      const key = cells[0]?.trim();
      const latitude = Number(cells[6]);
      const longitude = Number(cells[7]);
      const url = cells[8]?.trim();
      if (!key || !url || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return [];
      return [{
        key,
        region: cells[1]?.trim() || "Hong Kong",
        district: cells[2]?.trim() || "Hong Kong",
        description: cells[3]?.trim() || key,
        latitude,
        longitude,
        url,
      }];
    });
}

function withoutCameraKey(description: string): string {
  return description.replace(/\s*\[[A-Z0-9]+\]\s*$/i, "").trim();
}

async function hongKongScenes(): Promise<Scene[]> {
  const base = "https://static.data.gov.hk/td/traffic-snapshot-images/code";
  const [englishBuffer, chineseBuffer] = await Promise.all([
    fetchArrayBuffer(`${base}/Traffic_Camera_Locations_En.csv`, { next: { revalidate: 43_200 } }),
    fetchArrayBuffer(`${base}/Traffic_Camera_Locations_Sc.csv`, { next: { revalidate: 43_200 } }),
  ]);
  const english = parseHongKongCameraTsv(englishBuffer);
  const chinese = new Map(parseHongKongCameraTsv(chineseBuffer).map((camera) => [camera.key, camera]));
  const byKey = new Map(english.map((camera) => [camera.key, camera]));
  const preferred = ["H216F", "H904F", "H429F"];
  const stride = Math.max(1, Math.floor(english.length / 8));
  const selected = [
    ...preferred.flatMap((key) => {
      const camera = byKey.get(key);
      return camera ? [camera] : [];
    }),
    ...english.filter((_, index) => index % stride === 0),
  ]
    .filter(
      (camera, index, cameras) =>
        cameras.findIndex((candidate) => candidate.key === camera.key) === index,
    )
    .slice(0, 8);
  const results = await Promise.allSettled(
    selected.map(async (camera) => ({
      camera,
      probe: await probeAsset(camera.url, "image/", 120),
    })),
  );
  return results.flatMap((result, index) => {
    if (result.status !== "fulfilled") return [];
    const { camera, probe } = result.value;
    const zh = chinese.get(camera.key);
    const channel = currentPlaceChannel(new Date(probe.checkedAt), camera.latitude, camera.longitude);
    return [
      publicScene({
        id: `public-hk-${camera.key.toLowerCase()}`,
        slug: `hong-kong-${camera.key.toLowerCase()}`,
        city: camera.district,
        region: camera.region,
        country: "Hong Kong",
        countryCode: "HK",
        latitude: camera.latitude,
        longitude: camera.longitude,
        timezone: "Asia/Hong_Kong",
        title: {
          en: withoutCameraKey(camera.description),
          zh: withoutCameraKey(zh?.description ?? camera.description),
        },
        ...channel,
        kind: "image",
        mode: "near-live",
        posterUrl: versionedUrl(camera.url, probe.lastModifiedAt),
        audio: false,
        refreshIntervalSeconds: 120,
        fit: "contain",
        attribution: {
          name: "Hong Kong Transport Department / DATA.GOV.HK",
          url: "https://data.gov.hk/en-data/dataset/hk-td-tis_2-traffic-snapshot-images",
        },
        checkedAt: probe.checkedAt,
        capturedAt: probe.lastModifiedAt,
        latencyMs: probe.latencyMs,
        contentLength: probe.contentLength,
        score: 84 - index * 0.5,
        labels: ["near-live", "traffic snapshot", "Hong Kong", "open data"],
        reason: {
          en: "Hong Kong Transport Department publishes this current traffic frame every two minutes; the image timestamp was verified at request time.",
          zh: "香港运输署约每两分钟发布一次当前交通快拍；本次请求已核验图像时间戳。",
        },
        confidence: 0.98,
        evidence: [
          `Operator file modified ${probe.lastModifiedAt}`,
          "DATA.GOV.HK update frequency: every 2 minutes",
          "Free commercial and non-commercial reuse with Government and DATA.GOV.HK attribution",
        ],
      }),
    ];
  });
}

interface TorontoFeature {
  attributes?: {
    IMAGEURL?: string;
    MAINROAD?: string;
    CROSSROAD?: string;
    LONGITUDE?: number;
    LATITUDE?: number;
    REC_ID?: number;
  };
}

interface TorontoResponse {
  features?: TorontoFeature[];
}

async function torontoScenes(): Promise<Scene[]> {
  const query = new URL("https://gis.toronto.ca/arcgis/rest/services/cot_geospatial2/MapServer/3/query");
  query.searchParams.set("where", "1=1");
  query.searchParams.set("outFields", "IMAGEURL,MAINROAD,CROSSROAD,LONGITUDE,LATITUDE,REC_ID");
  query.searchParams.set("returnGeometry", "false");
  query.searchParams.set("orderByFields", "REC_ID ASC");
  query.searchParams.set("resultRecordCount", "20");
  query.searchParams.set("f", "json");
  const response = await fetchJson<TorontoResponse>(query.toString(), { next: { revalidate: 43_200 } });
  const cameras = (response.features ?? []).flatMap((feature) => {
    const value = feature.attributes;
    if (
      !value?.IMAGEURL ||
      typeof value.REC_ID !== "number" ||
      typeof value.LATITUDE !== "number" ||
      typeof value.LONGITUDE !== "number"
    ) return [];
    return [{
      imageUrl: value.IMAGEURL,
      id: value.REC_ID,
      mainRoad: value.MAINROAD ?? "Toronto road",
      crossRoad: value.CROSSROAD ?? "",
      latitude: value.LATITUDE,
      longitude: value.LONGITUDE,
    }];
  });
  const results = await Promise.allSettled(
    cameras.map(async (camera) => ({
      camera,
      probe: await probeAsset(camera.imageUrl, "image/", 120),
    })),
  );
  return results.flatMap((result, index) => {
    if (result.status !== "fulfilled") return [];
    const { camera, probe } = result.value;
    const channel = currentPlaceChannel(new Date(probe.checkedAt), camera.latitude, camera.longitude);
    const location = `${camera.mainRoad}${camera.crossRoad ? ` at ${camera.crossRoad}` : ""}`;
    return [
      publicScene({
        id: `public-toronto-${camera.id}`,
        slug: `toronto-traffic-${camera.id}`,
        city: "Toronto",
        region: "Ontario",
        country: "Canada",
        countryCode: "CA",
        latitude: camera.latitude,
        longitude: camera.longitude,
        timezone: "America/Toronto",
        title: { en: location, zh: `多伦多实时路况 · ${location}` },
        ...channel,
        kind: "image",
        mode: "near-live",
        posterUrl: versionedUrl(camera.imageUrl, probe.lastModifiedAt),
        audio: false,
        refreshIntervalSeconds: 180,
        fit: "contain",
        attribution: {
          name: "Contains information licensed under the Open Government Licence – Toronto",
          url: "https://open.toronto.ca/dataset/traffic-cameras/",
        },
        checkedAt: probe.checkedAt,
        capturedAt: probe.lastModifiedAt,
        latencyMs: probe.latencyMs,
        contentLength: probe.contentLength,
        score: 83 - index * 0.5,
        labels: ["near-live", "traffic snapshot", "Toronto", "open government data"],
        reason: {
          en: "The City of Toronto's current public camera image passed a direct freshness check; the operator refreshes stills every two to three minutes.",
          zh: "多伦多市公开摄像机的当前图像已通过直接新鲜度检查；运营方约每两至三分钟刷新一次。",
        },
        confidence: 0.98,
        evidence: [
          `Operator file modified ${probe.lastModifiedAt}`,
          "City of Toronto stated refresh interval: 2–3 minutes",
          "Open Government Licence – Toronto permits commercial and non-commercial reuse with attribution",
        ],
      }),
    ];
  });
}

interface DigitrafficMetadata {
  features?: Array<{
    id?: string;
    geometry?: { coordinates?: number[] };
    properties?: {
      id?: string;
      name?: string;
      collectionStatus?: string;
      presets?: Array<{ id?: string; inCollection?: boolean }>;
    };
  }>;
}

interface DigitrafficData {
  stations?: Array<{
    id?: string;
    presets?: Array<{ id?: string; measuredTime?: string }>;
  }>;
}

function readableDigitrafficName(value: string): { city: string; title: string } {
  const words = value.split("_").slice(1).filter(Boolean);
  const city = words[0] ?? "Road camera";
  return { city, title: words.join(" ") || value };
}

async function digitrafficScenes(): Promise<Scene[]> {
  const headers = {
    Accept: "application/json",
    "Accept-Encoding": "gzip",
    "Digitraffic-User": process.env.DIGITRAFFIC_USER ?? "LiveEarth/0.1 public-feed-adapter",
  };
  const [metadata, current] = await Promise.all([
    fetchJson<DigitrafficMetadata>("https://tie.digitraffic.fi/api/weathercam/v1/stations", {
      headers,
      next: { revalidate: 43_200 },
    }),
    fetchJson<DigitrafficData>("https://tie.digitraffic.fi/api/weathercam/v1/stations/data", {
      headers,
      next: { revalidate: 30 },
    }),
  ]);
  const stations = new Map(
    (metadata.features ?? []).flatMap((feature) => {
      const id = feature.properties?.id ?? feature.id;
      const coordinates = feature.geometry?.coordinates;
      if (!id || !coordinates || typeof coordinates[0] !== "number" || typeof coordinates[1] !== "number") {
        return [];
      }
      const activePresets = new Set(
        (feature.properties?.presets ?? [])
          .filter((preset) => preset.inCollection && preset.id)
          .map((preset) => preset.id as string),
      );
      return [[id, {
        id,
        name: feature.properties?.name ?? id,
        longitude: coordinates[0],
        latitude: coordinates[1],
        activePresets,
        gathering: feature.properties?.collectionStatus === "GATHERING",
      }] as const];
    }),
  );
  const candidates = (current.stations ?? [])
    .flatMap((stationData) => {
      const station = stationData.id ? stations.get(stationData.id) : undefined;
      if (!station?.gathering) return [];
      return (stationData.presets ?? []).flatMap((preset) => {
        if (!preset.id || !preset.measuredTime || !station.activePresets.has(preset.id)) return [];
        const measuredAt = new Date(preset.measuredTime).getTime();
        if (!Number.isFinite(measuredAt)) return [];
        return [{ station, presetId: preset.id, measuredAt }];
      });
    })
    .sort((a, b) => b.measuredAt - a.measuredAt);
  const selected: typeof candidates = [];
  const usedStations = new Set<string>();
  for (const candidate of candidates) {
    if (usedStations.has(candidate.station.id)) continue;
    if (Date.now() - candidate.measuredAt > 15 * 60_000) continue;
    selected.push(candidate);
    usedStations.add(candidate.station.id);
    if (selected.length === 8) break;
  }
  const results = await Promise.allSettled(
    selected.map(async (candidate) => {
      const imageUrl = `https://weathercam.digitraffic.fi/${candidate.presetId}.jpg`;
      return {
        candidate,
        imageUrl,
        probe: await probeAsset(imageUrl, "image/", 300),
      };
    }),
  );
  return results.flatMap((result, index) => {
    if (result.status !== "fulfilled") return [];
    const { candidate, imageUrl, probe } = result.value;
    const { station } = candidate;
    const capturedAt = new Date(candidate.measuredAt).toISOString();
    const name = readableDigitrafficName(station.name);
    const channel = currentPlaceChannel(new Date(probe.checkedAt), station.latitude, station.longitude);
    return [
      publicScene({
        id: `public-digitraffic-${candidate.presetId.toLowerCase()}`,
        slug: `finland-${candidate.presetId.toLowerCase()}`,
        city: name.city,
        region: "Finnish road network",
        country: "Finland",
        countryCode: "FI",
        latitude: station.latitude,
        longitude: station.longitude,
        timezone: "Europe/Helsinki",
        title: {
          en: `${name.title} weather camera`,
          zh: `芬兰道路天气摄像机 · ${name.title}`,
        },
        ...channel,
        kind: "image",
        mode: "near-live",
        posterUrl: versionedUrl(imageUrl, capturedAt),
        audio: false,
        refreshIntervalSeconds: 600,
        fit: "contain",
        attribution: {
          name: "Source: Fintraffic / digitraffic.fi, license CC 4.0 BY",
          url: "https://www.digitraffic.fi/en/road-traffic/",
        },
        checkedAt: probe.checkedAt,
        capturedAt,
        latencyMs: probe.latencyMs,
        contentLength: probe.contentLength,
        score: 82 - index * 0.5,
        labels: ["near-live", "weather camera", "Finland", "CC BY 4.0"],
        reason: {
          en: "Fintraffic's open weather-camera API reports this as one of its newest collected frames; the image endpoint also passed a health check.",
          zh: "Fintraffic 开放天气摄像机 API 将其报告为最新采集画面之一，图像地址也已通过健康检查。",
        },
        confidence: 0.98,
        evidence: [
          `API measuredTime ${capturedAt}`,
          "Camera state: GATHERING; preset: inCollection=true",
          "Fintraffic open data licence: CC BY 4.0",
        ],
      }),
    ];
  });
}

interface TflPlace {
  commonName?: string;
  lat?: number;
  lon?: number;
  additionalProperties?: Array<{ key?: string; value?: string }>;
}

const TFL_CAMERAS = [
  {
    id: "JamCams_00001.07450",
    assetId: "00001.07450",
    slug: "piccadilly-circus",
    name: "Piccadilly Circus",
    latitude: 51.5096,
    longitude: -0.13484,
  },
  {
    id: "JamCams_00001.06501",
    assetId: "00001.06501",
    slug: "parliament-square",
    name: "Parliament Square",
    latitude: 51.5011,
    longitude: -0.12628,
  },
  {
    id: "JamCams_00001.06519",
    assetId: "00001.06519",
    slug: "buckingham-palace-road",
    name: "Buckingham Palace Rd/Eaton Lane",
    latitude: 51.4972,
    longitude: -0.14465,
  },
  {
    id: "JamCams_00001.08750",
    assetId: "00001.08750",
    slug: "hyde-park-corner",
    name: "Hyde Park Corner/Park Lane",
    latitude: 51.5033,
    longitude: -0.15099,
  },
  {
    id: "JamCams_00001.03500",
    assetId: "00001.03500",
    slug: "tower-bridge-approach",
    name: "Tower Bridge App./East Smithfield",
    latitude: 51.509,
    longitude: -0.07368,
  },
  {
    id: "JamCams_00001.04502",
    assetId: "00001.04502",
    slug: "westminster-bridge",
    name: "Westminster Bridge/York Rd",
    latitude: 51.5009,
    longitude: -0.11762,
  },
  {
    id: "JamCams_00001.08850",
    assetId: "00001.08850",
    slug: "marble-arch",
    name: "Marble Arch",
    latitude: 51.5133,
    longitude: -0.16018,
  },
  {
    id: "JamCams_00001.06502",
    assetId: "00001.06502",
    slug: "trafalgar-square",
    name: "Trafalgar Square",
    latitude: 51.5074,
    longitude: -0.12765,
  },
] as const;

async function tflScenes(): Promise<Scene[]> {
  const apiKey = process.env.TFL_API_KEY?.trim();
  const results = await Promise.allSettled(
    TFL_CAMERAS.map(async (camera) => {
      const assetRoot = "https://s3-eu-west-1.amazonaws.com/jamcams.tfl.gov.uk";
      let imageUrl = `${assetRoot}/${camera.assetId}.jpg`;
      let videoUrl = `${assetRoot}/${camera.assetId}.mp4`;
      let name: string = camera.name;
      let latitude: number = camera.latitude;
      let longitude: number = camera.longitude;

      if (apiKey) {
        const url = new URL(`https://api.tfl.gov.uk/Place/${camera.id}`);
        url.searchParams.set("app_key", apiKey);
        const place = await fetchJson<TflPlace>(url.toString(), {
          next: { revalidate: 300 },
        });
        const properties = new Map(
          (place.additionalProperties ?? []).flatMap((property) =>
            property.key && property.value ? [[property.key, property.value] as const] : [],
          ),
        );
        if (
          properties.get("available") !== "true" ||
          !properties.get("imageUrl") ||
          !properties.get("videoUrl") ||
          typeof place.lat !== "number" ||
          typeof place.lon !== "number"
        ) throw new Error("TfL camera metadata was incomplete");
        imageUrl = properties.get("imageUrl") as string;
        videoUrl = properties.get("videoUrl") as string;
        name = place.commonName ?? name;
        latitude = place.lat;
        longitude = place.lon;
      }
      const [image, video] = await Promise.all([
        probeAsset(imageUrl, "image/", 120),
        probeAsset(videoUrl, "video/", 120),
      ]);
      return { camera, name, latitude, longitude, imageUrl, videoUrl, image, video };
    }),
  );
  return results.flatMap((result, index) => {
    if (result.status !== "fulfilled") return [];
    const { camera, name, latitude, longitude, imageUrl, videoUrl, image, video } = result.value;
    const channel = currentPlaceChannel(new Date(video.checkedAt), latitude, longitude);
    return [
      publicScene({
        id: `public-tfl-${camera.slug}`,
        slug: `london-${camera.slug}`,
        city: "London",
        region: name,
        country: "United Kingdom",
        countryCode: "GB",
        latitude,
        longitude,
        timezone: "Europe/London",
        title: { en: `${name} JamCam`, zh: `伦敦 JamCam · ${name}` },
        ...channel,
        kind: "mp4",
        mode: "near-live",
        posterUrl: versionedUrl(imageUrl, image.lastModifiedAt),
        playbackUrl: versionedUrl(videoUrl, video.lastModifiedAt),
        audio: false,
        refreshIntervalSeconds: 180,
        fit: "contain",
        attribution: {
          name: "Transport for London JamCam · image shown uncropped",
          url: "https://tfl.gov.uk/info-for/open-data-users/our-open-data",
        },
        checkedAt: video.checkedAt,
        capturedAt: video.lastModifiedAt,
        latencyMs: video.latencyMs,
        contentLength: video.contentLength,
        score: 86 - index,
        labels: [
          "near-live clip",
          "London",
          "TfL JamCam",
          apiKey ? "registered API" : "direct operator asset",
        ],
        reason: {
          en: "TfL's registered open-data feed supplied a current short JamCam clip, displayed in full without cropping its branding or timestamp.",
          zh: "TfL 注册开放数据接口提供了当前 JamCam 短片；画面完整显示，未裁切品牌或时间戳。",
        },
        confidence: 0.98,
        evidence: [
          `Operator clip modified ${video.lastModifiedAt}`,
          "TfL publishes JamCam data about every 2 minutes",
          apiKey
            ? "TfL Unified API request used a registered app_key"
            : "Media loaded from the stable JamCam asset URL published by TfL's Unified API",
          "TfL camera imagery is displayed uncropped as required",
        ],
      }),
    ];
  });
}

export const getPublicFeedScenes = cache(async (): Promise<Scene[]> => {
  const sources = [
    ["youtube", youtubeLiveScenes],
    ["noaa", noaaScenes],
    ["ndbc", ndbcBuoyCamScenes],
    ["hong-kong", hongKongScenes],
    ["toronto", torontoScenes],
    ["digitraffic", digitrafficScenes],
    ["tfl", tflScenes],
  ] as const;
  const results = await Promise.allSettled(sources.map(([, load]) => load()));
  const now = new Date();
  return results.flatMap((result, index) => {
    if (result.status === "fulfilled") return result.value.filter((scene) => isSceneEligible(scene, now));
    const detail = result.reason instanceof Error ? result.reason.message : "unknown error";
    console.warn(
      `[public-feeds] ${sources[index]?.[0] ?? "unknown"} source unavailable: ${detail}`,
    );
    return [];
  });
});

export async function createPublicRanking(channel: Channel): Promise<RankingSnapshot> {
  const now = new Date();
  const scenes = (await getPublicFeedScenes()).filter(
    (scene) => channel === "earth" || scene.channels.includes(channel),
  );
  const interval = 30_000;
  const versionTime = Math.floor(now.getTime() / interval) * interval;
  return {
    channel,
    rankingVersion: `public-${channel}-${new Date(versionTime).toISOString()}`,
    generatedAt: now.toISOString(),
    nextRefreshAt: new Date(versionTime + interval).toISOString(),
    entries: rankScenes(scenes, {
      limit: 10,
      now,
      diversify: channel === "earth",
      score: channel === "earth" ? "editorial" : "channel",
    }),
    isDemo: false,
  };
}
