import { describe, expect, it } from "vitest";
import { createDemoScenes } from "./fixtures";
import {
  calculateChannelScore,
  calculateEditorialScore,
  isSceneEligible,
  rankScenes,
} from "./ranking";

describe("ranking domain", () => {
  it("uses the agreed channel weights", () => {
    expect(
      calculateChannelScore({
        visualImpact: 100,
        eventIntensity: 80,
        motion: 60,
        visibility: 40,
        technicalQuality: 20,
        rarity: 0,
      }),
    ).toBe(63);
  });

  it("uses the agreed editorial weights", () => {
    expect(
      calculateEditorialScore({
        channelScore: 80,
        rarity: 60,
        freshness: 100,
        temporalRelevance: 80,
      }),
    ).toBe(79);
  });

  it("excludes stale and unhealthy streams", () => {
    const now = new Date("2026-08-31T12:00:00.000Z");
    const [scene] = createDemoScenes(now);
    expect(scene).toBeDefined();
    if (!scene) return;
    expect(isSceneEligible(scene, now)).toBe(true);
    expect(
      isSceneEligible(
        { ...scene, health: { ...scene.health, state: "degraded" } },
        now,
      ),
    ).toBe(false);
  });

  it("uses the declared operator cadence for clearly labelled near-live frames", () => {
    const now = new Date("2026-08-31T12:00:00.000Z");
    const [scene] = createDemoScenes(now);
    expect(scene).toBeDefined();
    if (!scene) return;
    const nearLive = {
      ...scene,
      media: {
        ...scene.media,
        kind: "image" as const,
        mode: "near-live" as const,
        refreshIntervalSeconds: 600,
      },
      health: {
        ...scene.health,
        lastFrameAt: new Date(now.getTime() - 9 * 60_000).toISOString(),
      },
    };
    expect(isSceneEligible(nearLive, now)).toBe(true);
    expect(
      isSceneEligible(
        {
          ...nearLive,
          health: {
            ...nearLive.health,
            lastFrameAt: new Date(now.getTime() - 16 * 60_000).toISOString(),
          },
        },
        now,
      ),
    ).toBe(false);
  });

  it("supports an explicit age window for slower periodic public cameras", () => {
    const now = new Date("2026-08-31T12:00:00.000Z");
    const [scene] = createDemoScenes(now);
    expect(scene).toBeDefined();
    if (!scene) return;
    const periodic = {
      ...scene,
      media: {
        ...scene.media,
        kind: "image" as const,
        mode: "near-live" as const,
        refreshIntervalSeconds: 3_600,
        maxFrameAgeSeconds: 7_200,
      },
      health: {
        ...scene.health,
        lastFrameAt: new Date(now.getTime() - 90 * 60_000).toISOString(),
      },
    };
    expect(isSceneEligible(periodic, now)).toBe(true);
    expect(
      isSceneEligible(
        {
          ...periodic,
          health: {
            ...periodic.health,
            lastFrameAt: new Date(now.getTime() - 121 * 60_000).toISOString(),
          },
        },
        now,
      ),
    ).toBe(false);
  });

  it("avoids adjacent channels and caps country repetition", () => {
    const now = new Date("2026-08-31T12:00:00.000Z");
    const entries = rankScenes(createDemoScenes(now), { now });
    const countryCounts = new Map<string, number>();
    for (const entry of entries) {
      countryCounts.set(
        entry.scene.countryCode,
        (countryCounts.get(entry.scene.countryCode) ?? 0) + 1,
      );
    }
    expect(Math.max(...countryCounts.values())).toBeLessThanOrEqual(2);
    for (let index = 1; index < entries.length; index += 1) {
      expect(entries[index]?.scene.primaryChannel).not.toBe(
        entries[index - 1]?.scene.primaryChannel,
      );
    }
  });

  it("uses channel scores without Earth-edition diversity rules for channel lists", () => {
    const now = new Date("2026-08-31T12:00:00.000Z");
    const [first, second] = createDemoScenes(now);
    expect(first && second).toBeDefined();
    if (!first || !second) return;
    const highEditorial = {
      ...first,
      analysis: { ...first.analysis, channelScore: 40, editorialScore: 99 },
    };
    const highChannel = {
      ...second,
      analysis: { ...second.analysis, channelScore: 98, editorialScore: 50 },
    };
    const entries = rankScenes([highEditorial, highChannel], {
      now,
      diversify: false,
      score: "channel",
    });
    expect(entries[0]?.scene.id).toBe(highChannel.id);
  });
});
