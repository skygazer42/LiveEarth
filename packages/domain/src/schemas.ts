import { z } from "zod";

function isValidTimezone(value: string) {
  try {
    new Intl.DateTimeFormat("en", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

export const localizedTextSchema = z.object({
  en: z.string().min(1).max(240),
  zh: z.string().min(1).max(120),
});

export const scoreBreakdownSchema = z.object({
  visualImpact: z.number().min(0).max(100),
  eventIntensity: z.number().min(0).max(100),
  motion: z.number().min(0).max(100),
  visibility: z.number().min(0).max(100),
  technicalQuality: z.number().min(0).max(100),
  rarity: z.number().min(0).max(100),
});

export const visionAnalysisOutputSchema = z.object({
  labels: z.array(z.string().min(1).max(40)).max(8),
  reason: localizedTextSchema,
  breakdown: scoreBreakdownSchema,
  confidence: z.number().min(0).max(1),
  evidence: z.array(z.string().min(1).max(140)).max(6),
});

export const feedRegistrationSchema = z
  .object({
    name: z.string().min(2).max(120),
    slug: z.string().min(3).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    city: z.string().min(1).max(100),
    region: z.string().min(1).max(100),
    country: z.string().min(1).max(100),
    countryCode: z.string().length(2).regex(/^[A-Z]{2}$/),
    title: localizedTextSchema,
    sourceUrl: z.url().or(z.string().regex(/^(rtsp|rtmps|srt):\/\//)),
    sourceProtocol: z.enum(["srt", "rtmps", "rtsp", "hls"]),
    playbackUrl: z.url().refine((url) => /^https:\/\/.+\.m3u8(?:\?|$)/i.test(url), {
      message: "Playback URL must be an HTTPS HLS manifest",
    }),
    posterUrl: z.url().refine((url) => url.startsWith("https://"), {
      message: "Poster URL must use HTTPS",
    }),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    timezone: z.string().min(1).max(80).refine(isValidTimezone, {
      message: "Timezone must be a valid IANA identifier",
    }),
    primaryChannel: z.enum(["storm", "ocean", "night"]),
    channels: z.array(z.enum(["storm", "ocean", "night"])).min(1),
    attribution: z.object({
      name: z.string().min(1).max(120),
      url: z.url(),
    }),
    rightsExpiresAt: z.iso.datetime(),
    allowAudio: z.boolean(),
    allowTranscoding: z.literal(true),
    allowFrameAnalysis: z.literal(true),
    allowDerivedMetadata: z.literal(true),
    maxRetentionHours: z.number().int().min(0).max(24),
  })
  .superRefine((feed, context) => {
    const scheme = feed.sourceUrl.slice(0, feed.sourceUrl.indexOf(":"));
    const expectedScheme = feed.sourceProtocol === "hls" ? "http" : feed.sourceProtocol;
    if (feed.sourceProtocol !== "hls" && scheme !== expectedScheme) {
      context.addIssue({
        code: "custom",
        path: ["sourceUrl"],
        message: "Source URL scheme must match sourceProtocol",
      });
    }
    if (feed.sourceProtocol === "hls" && scheme !== "http" && scheme !== "https") {
      context.addIssue({
        code: "custom",
        path: ["sourceUrl"],
        message: "HLS source URL must use HTTP or HTTPS",
      });
    }
    if (!feed.channels.includes(feed.primaryChannel)) {
      context.addIssue({
        code: "custom",
        path: ["primaryChannel"],
        message: "Primary channel must be selected in channels",
      });
    }
  });

export type VisionAnalysisOutput = z.infer<typeof visionAnalysisOutputSchema>;
