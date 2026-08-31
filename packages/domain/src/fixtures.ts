import { calculateChannelScore, calculateEditorialScore, rankScenes } from "./ranking";
import type {
  Channel,
  LocalizedText,
  RankingSnapshot,
  Scene,
  SceneChannel,
  ScoreBreakdown,
} from "./types";

interface DemoSceneInput {
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
  posterUrl: string;
  reason: LocalizedText;
  labels: string[];
  breakdown: ScoreBreakdown;
  temporalRelevance: number;
  weather: {
    weatherCode: number;
    temperatureC: number;
    windKph: number;
    precipitationMm: number;
    cloudCoverPercent: number;
  };
}

const DEMO_INPUTS: DemoSceneInput[] = [
  {
    id: "demo-faroe-front",
    slug: "faroe-atlantic-front",
    city: "Tórshavn",
    region: "Streymoy",
    country: "Faroe Islands",
    countryCode: "FO",
    latitude: 62.0079,
    longitude: -6.7900,
    timezone: "Atlantic/Faroe",
    title: {
      en: "An Atlantic front folds over the harbour",
      zh: "大西洋锋面正越过港湾",
    },
    primaryChannel: "storm",
    channels: ["storm", "ocean"],
    posterUrl:
      "https://images.unsplash.com/photo-1527482797697-8795b05a13fe?auto=format&fit=crop&w=2200&q=86",
    reason: {
      en: "Fast cloud layers and a bright rain shaft are converging over the harbour.",
      zh: "快速移动的云层与明亮雨幕正在港湾上空交汇。",
    },
    labels: ["rain shaft", "shelf cloud", "harbour", "high motion"],
    breakdown: {
      visualImpact: 96,
      eventIntensity: 94,
      motion: 91,
      visibility: 82,
      technicalQuality: 94,
      rarity: 92,
    },
    temporalRelevance: 98,
    weather: {
      weatherCode: 95,
      temperatureC: 8,
      windKph: 52,
      precipitationMm: 5.6,
      cloudCoverPercent: 96,
    },
  },
  {
    id: "demo-nazare-swell",
    slug: "nazare-north-swell",
    city: "Nazaré",
    region: "Leiria",
    country: "Portugal",
    countryCode: "PT",
    latitude: 39.6012,
    longitude: -9.0701,
    timezone: "Europe/Lisbon",
    title: {
      en: "North swell meets the Nazaré canyon",
      zh: "北向涌浪抵达纳扎雷峡谷",
    },
    primaryChannel: "ocean",
    channels: ["ocean"],
    posterUrl:
      "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=2200&q=86",
    reason: {
      en: "Long-period sets are arriving cleanly, with unusually high spray in the offshore wind.",
      zh: "长周期浪组整齐抵达，离岸风扬起了少见的高大水雾。",
    },
    labels: ["ocean swell", "offshore wind", "spray", "long period"],
    breakdown: {
      visualImpact: 94,
      eventIntensity: 91,
      motion: 97,
      visibility: 90,
      technicalQuality: 92,
      rarity: 88,
    },
    temporalRelevance: 94,
    weather: {
      weatherCode: 3,
      temperatureC: 17,
      windKph: 31,
      precipitationMm: 0,
      cloudCoverPercent: 68,
    },
  },
  {
    id: "demo-tokyo-rain",
    slug: "tokyo-rain-after-dark",
    city: "Tokyo",
    region: "Kantō",
    country: "Japan",
    countryCode: "JP",
    latitude: 35.6764,
    longitude: 139.6500,
    timezone: "Asia/Tokyo",
    title: {
      en: "Rain turns the crossing into a field of colour",
      zh: "雨水把街口变成流动的色场",
    },
    primaryChannel: "night",
    channels: ["night", "storm"],
    posterUrl:
      "https://images.unsplash.com/photo-1519608487953-e999c86e7455?auto=format&fit=crop&w=2200&q=86",
    reason: {
      en: "Dense rain and wet asphalt are producing exceptional colour separation after dark.",
      zh: "密集雨丝与湿润路面在入夜后形成了格外鲜明的色彩层次。",
    },
    labels: ["rain", "reflections", "pedestrian motion", "city night"],
    breakdown: {
      visualImpact: 92,
      eventIntensity: 82,
      motion: 88,
      visibility: 85,
      technicalQuality: 96,
      rarity: 84,
    },
    temporalRelevance: 96,
    weather: {
      weatherCode: 63,
      temperatureC: 22,
      windKph: 14,
      precipitationMm: 3.2,
      cloudCoverPercent: 100,
    },
  },
  {
    id: "demo-florida-lightning",
    slug: "key-west-distant-lightning",
    city: "Key West",
    region: "Florida",
    country: "United States",
    countryCode: "US",
    latitude: 24.5551,
    longitude: -81.7800,
    timezone: "America/New_York",
    title: {
      en: "Distant lightning walks across the horizon",
      zh: "远方闪电正沿海平线移动",
    },
    primaryChannel: "storm",
    channels: ["storm", "ocean", "night"],
    posterUrl:
      "https://images.unsplash.com/photo-1499346030926-9a72daac6c63?auto=format&fit=crop&w=2200&q=86",
    reason: {
      en: "Repeated illumination is revealing the full height of a storm cell beyond the islands.",
      zh: "反复闪光照出了群岛外雷暴单体的完整高度。",
    },
    labels: ["lightning", "storm cell", "night horizon", "ocean"],
    breakdown: {
      visualImpact: 91,
      eventIntensity: 89,
      motion: 78,
      visibility: 79,
      technicalQuality: 90,
      rarity: 91,
    },
    temporalRelevance: 93,
    weather: {
      weatherCode: 96,
      temperatureC: 27,
      windKph: 36,
      precipitationMm: 7.1,
      cloudCoverPercent: 92,
    },
  },
  {
    id: "demo-busan-blue-hour",
    slug: "busan-blue-hour-tide",
    city: "Busan",
    region: "Yeongnam",
    country: "South Korea",
    countryCode: "KR",
    latitude: 35.1796,
    longitude: 129.0756,
    timezone: "Asia/Seoul",
    title: {
      en: "The tide holds the last blue light",
      zh: "潮水留住了最后一层蓝光",
    },
    primaryChannel: "ocean",
    channels: ["ocean", "night"],
    posterUrl:
      "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=2200&q=86",
    reason: {
      en: "A clear horizon and slow tidal movement are extending the blue-hour colour unusually late.",
      zh: "清晰海平线与缓慢潮汐让蓝调时刻比往常延续得更久。",
    },
    labels: ["blue hour", "calm tide", "clear horizon", "coast"],
    breakdown: {
      visualImpact: 88,
      eventIntensity: 72,
      motion: 74,
      visibility: 96,
      technicalQuality: 95,
      rarity: 78,
    },
    temporalRelevance: 97,
    weather: {
      weatherCode: 1,
      temperatureC: 19,
      windKph: 9,
      precipitationMm: 0,
      cloudCoverPercent: 22,
    },
  },
  {
    id: "demo-vancouver-harbour",
    slug: "vancouver-harbour-lights",
    city: "Vancouver",
    region: "British Columbia",
    country: "Canada",
    countryCode: "CA",
    latitude: 49.2827,
    longitude: -123.1207,
    timezone: "America/Vancouver",
    title: {
      en: "Harbour lights settle into the mist",
      zh: "港湾灯火正在薄雾中沉静下来",
    },
    primaryChannel: "night",
    channels: ["night", "ocean"],
    posterUrl:
      "https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?auto=format&fit=crop&w=2200&q=86",
    reason: {
      en: "Low mist is softening the skyline while the harbour remains sharply reflected.",
      zh: "低空薄雾柔化了天际线，港湾倒影却依然清晰。",
    },
    labels: ["harbour", "mist", "city lights", "reflections"],
    breakdown: {
      visualImpact: 86,
      eventIntensity: 68,
      motion: 70,
      visibility: 84,
      technicalQuality: 95,
      rarity: 76,
    },
    temporalRelevance: 95,
    weather: {
      weatherCode: 45,
      temperatureC: 12,
      windKph: 7,
      precipitationMm: 0.2,
      cloudCoverPercent: 72,
    },
  },
  {
    id: "demo-cape-town-surge",
    slug: "cape-town-winter-surge",
    city: "Cape Town",
    region: "Western Cape",
    country: "South Africa",
    countryCode: "ZA",
    latitude: -33.9249,
    longitude: 18.4241,
    timezone: "Africa/Johannesburg",
    title: {
      en: "Winter surf wraps around the headland",
      zh: "冬季海浪正绕过岬角",
    },
    primaryChannel: "ocean",
    channels: ["ocean", "storm"],
    posterUrl:
      "https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=2200&q=86",
    reason: {
      en: "Crossing wave trains are drawing long white lines around the headland.",
      zh: "交叉浪列正在岬角周围画出绵长的白线。",
    },
    labels: ["cross swell", "headland", "winter surf", "foam lines"],
    breakdown: {
      visualImpact: 84,
      eventIntensity: 80,
      motion: 89,
      visibility: 88,
      technicalQuality: 91,
      rarity: 75,
    },
    temporalRelevance: 86,
    weather: {
      weatherCode: 3,
      temperatureC: 14,
      windKph: 28,
      precipitationMm: 0,
      cloudCoverPercent: 64,
    },
  },
  {
    id: "demo-tromso-night",
    slug: "tromso-snowlight",
    city: "Tromsø",
    region: "Troms",
    country: "Norway",
    countryCode: "NO",
    latitude: 69.6492,
    longitude: 18.9553,
    timezone: "Europe/Oslo",
    title: {
      en: "Snow carries the city light uphill",
      zh: "积雪把城市灯光带上山坡",
    },
    primaryChannel: "night",
    channels: ["night"],
    posterUrl:
      "https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=2200&q=86",
    reason: {
      en: "Fresh snow and a clear low cloud base are making the hillside unusually luminous.",
      zh: "新雪与清晰低云底让整片山坡显得格外明亮。",
    },
    labels: ["snowlight", "polar night", "clear air", "hillside"],
    breakdown: {
      visualImpact: 85,
      eventIntensity: 70,
      motion: 62,
      visibility: 93,
      technicalQuality: 92,
      rarity: 82,
    },
    temporalRelevance: 91,
    weather: {
      weatherCode: 71,
      temperatureC: -4,
      windKph: 11,
      precipitationMm: 0.4,
      cloudCoverPercent: 48,
    },
  },
  {
    id: "demo-oahu-break",
    slug: "oahu-sunset-break",
    city: "Haleʻiwa",
    region: "Oʻahu",
    country: "United States",
    countryCode: "US",
    latitude: 21.5910,
    longitude: -158.1122,
    timezone: "Pacific/Honolulu",
    title: {
      en: "The last set catches the sunset",
      zh: "最后一组浪接住了落日",
    },
    primaryChannel: "ocean",
    channels: ["ocean"],
    posterUrl:
      "https://images.unsplash.com/photo-1470252649378-9c29740c9fa8?auto=format&fit=crop&w=2200&q=86",
    reason: {
      en: "Backlit spray is briefly outlining every breaking wave in the final sun.",
      zh: "落日前最后的逆光水雾，正短暂勾勒出每一道碎浪。",
    },
    labels: ["sunset", "backlit spray", "breaking waves", "warm light"],
    breakdown: {
      visualImpact: 89,
      eventIntensity: 74,
      motion: 86,
      visibility: 92,
      technicalQuality: 88,
      rarity: 72,
    },
    temporalRelevance: 99,
    weather: {
      weatherCode: 1,
      temperatureC: 26,
      windKph: 18,
      precipitationMm: 0,
      cloudCoverPercent: 18,
    },
  },
  {
    id: "demo-singapore-squall",
    slug: "singapore-harbour-squall",
    city: "Singapore",
    region: "Central Region",
    country: "Singapore",
    countryCode: "SG",
    latitude: 1.2903,
    longitude: 103.8519,
    timezone: "Asia/Singapore",
    title: {
      en: "A tropical squall erases the far shore",
      zh: "热带飑线正在抹去远岸",
    },
    primaryChannel: "storm",
    channels: ["storm", "ocean"],
    posterUrl:
      "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=2200&q=86",
    reason: {
      en: "A compact rain wall is moving quickly across the harbour without obscuring the near field.",
      zh: "紧凑雨墙正快速横过港湾，同时仍保留近景可见度。",
    },
    labels: ["tropical squall", "rain wall", "harbour", "fast motion"],
    breakdown: {
      visualImpact: 82,
      eventIntensity: 86,
      motion: 84,
      visibility: 71,
      technicalQuality: 90,
      rarity: 78,
    },
    temporalRelevance: 88,
    weather: {
      weatherCode: 95,
      temperatureC: 29,
      windKph: 39,
      precipitationMm: 8.3,
      cloudCoverPercent: 100,
    },
  },
];

export function createDemoScenes(now = new Date()): Scene[] {
  return DEMO_INPUTS.map((input, sceneIndex) => {
    const channelScore = calculateChannelScore(input.breakdown);
    const editorialScore = calculateEditorialScore({
      channelScore,
      rarity: input.breakdown.rarity,
      freshness: 100 - sceneIndex,
      temporalRelevance: input.temporalRelevance,
    });
    const observedAt = new Date(now.getTime() - 60_000 - sceneIndex * 4_000).toISOString();

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
        kind: "image",
        posterUrl: input.posterUrl,
        audio: false,
        demoOnly: true,
        attribution: {
          name: "Development fixture · Unsplash",
          url: "https://unsplash.com",
        },
      },
      health: {
        state: "live",
        checkedAt: new Date(now.getTime() - 10_000).toISOString(),
        lastFrameAt: new Date(now.getTime() - 20_000 - sceneIndex * 1_000).toISOString(),
        latencyMs: 1_200 + sceneIndex * 83,
        bitrateKbps: 4_800 - sceneIndex * 120,
        consecutiveFailures: 0,
        flags: [],
      },
      analysis: {
        observedAt,
        expiresAt: new Date(now.getTime() + 9 * 60_000).toISOString(),
        channelScore,
        editorialScore,
        breakdown: input.breakdown,
        labels: input.labels,
        reason: input.reason,
        confidence: Math.max(0.78, 0.96 - sceneIndex * 0.012),
        evidence: input.labels.slice(0, 3),
        weather: {
          observedAt,
          ...input.weather,
          source: "open-meteo",
        },
      },
      scoreHistory: Array.from({ length: 12 }, (_, index) => ({
        at: new Date(now.getTime() - (11 - index) * 2 * 60 * 60_000).toISOString(),
        score: Math.max(
          42,
          Math.min(99, editorialScore - 10 + Math.sin(index * 0.9 + sceneIndex) * 8 + index * 0.7),
        ),
      })),
    };
  });
}

export function createDemoRanking(
  channel: Channel,
  now = new Date(),
): RankingSnapshot {
  const scenes = createDemoScenes(now).filter(
    (scene) => channel === "earth" || scene.channels.includes(channel),
  );
  const ranked = rankScenes(scenes, {
    limit: 10,
    now,
    diversify: channel === "earth",
    score: channel === "earth" ? "editorial" : "channel",
  });
  const previousRanks = [2, 1, 3, 5, 4, 7, 6, 8, 10, 9];
  const entries = ranked.map((entry, index) => {
    const previousRank = previousRanks[index] ?? null;
    return {
      ...entry,
      previousRank,
      trend:
        previousRank === null
          ? ("new" as const)
          : previousRank === entry.rank
            ? ("steady" as const)
            : previousRank > entry.rank
              ? ("up" as const)
              : ("down" as const),
    };
  });
  const interval = 5 * 60_000;
  const versionTime = Math.floor(now.getTime() / interval) * interval;

  return {
    channel,
    rankingVersion: `demo-${channel}-${versionTime}`,
    generatedAt: new Date(versionTime).toISOString(),
    nextRefreshAt: new Date(versionTime + interval).toISOString(),
    entries,
    isDemo: true,
  };
}
