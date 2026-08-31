import { describe, expect, it } from "vitest";
import { feedRegistrationSchema, visionAnalysisOutputSchema } from "./schemas";

const validFeed = {
  name: "Nazaré North Beach",
  slug: "nazare-north-beach",
  city: "Nazaré",
  region: "Leiria",
  country: "Portugal",
  countryCode: "PT",
  title: { en: "North swell at Nazaré", zh: "纳扎雷北向涌浪" },
  sourceUrl: "rtsp://camera.example/live",
  sourceProtocol: "rtsp" as const,
  playbackUrl: "https://customer.example/live/manifest.m3u8",
  posterUrl: "https://customer.example/live/poster.jpg",
  latitude: 39.6012,
  longitude: -9.0701,
  timezone: "Europe/Lisbon",
  primaryChannel: "ocean" as const,
  channels: ["ocean"] as const,
  attribution: { name: "Camera operator", url: "https://operator.example" },
  rightsExpiresAt: "2027-09-01T00:00:00.000Z",
  allowAudio: false,
  allowTranscoding: true as const,
  allowFrameAnalysis: true as const,
  allowDerivedMetadata: true as const,
  maxRetentionHours: 24,
};

describe("feed registration contract", () => {
  it("accepts a source with every required analysis right", () => {
    expect(feedRegistrationSchema.safeParse(validFeed).success).toBe(true);
  });

  it("rejects mismatched protocols and missing analysis rights", () => {
    expect(
      feedRegistrationSchema.safeParse({
        ...validFeed,
        sourceProtocol: "srt",
        allowFrameAnalysis: false,
      }).success,
    ).toBe(false);
  });

  it("requires the primary channel to be part of the published channel set", () => {
    expect(
      feedRegistrationSchema.safeParse({
        ...validFeed,
        primaryChannel: "storm",
      }).success,
    ).toBe(false);
  });

  it("rejects invalid timezones and non-HLS playback endpoints", () => {
    expect(
      feedRegistrationSchema.safeParse({
        ...validFeed,
        timezone: "Near/The-Ocean",
        playbackUrl: "https://customer.example/live/video.mp4",
      }).success,
    ).toBe(false);
  });
});

describe("vision output contract", () => {
  it("rejects scores beyond the published scale", () => {
    const parsed = visionAnalysisOutputSchema.safeParse({
      labels: ["wave"],
      reason: { en: "A wave is visible.", zh: "可以看见海浪。" },
      breakdown: {
        visualImpact: 101,
        eventIntensity: 50,
        motion: 50,
        visibility: 50,
        technicalQuality: 50,
        rarity: 50,
      },
      confidence: 0.8,
      evidence: ["visible spray"],
    });
    expect(parsed.success).toBe(false);
  });
});
