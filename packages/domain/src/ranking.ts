import type {
  RankingEntry,
  RankingSnapshot,
  Scene,
  ScoreBreakdown,
  SceneChannel,
} from "./types";

const CHANNEL_WEIGHTS = {
  visualImpact: 0.3,
  eventIntensity: 0.2,
  motion: 0.15,
  visibility: 0.15,
  technicalQuality: 0.1,
  rarity: 0.1,
} as const;

const MAX_PER_CHANNEL = 4;
const MAX_PER_COUNTRY = 2;
const FRESHNESS_WINDOW_MS = 10 * 60 * 1000;

export function calculateChannelScore(breakdown: ScoreBreakdown): number {
  let score = 0;
  for (const key of Object.keys(CHANNEL_WEIGHTS) as Array<keyof ScoreBreakdown>) {
    score += breakdown[key] * CHANNEL_WEIGHTS[key];
  }
  return roundScore(score);
}

export function calculateEditorialScore(input: {
  channelScore: number;
  rarity: number;
  freshness: number;
  temporalRelevance: number;
}): number {
  return roundScore(
    input.channelScore * 0.5 +
      input.rarity * 0.2 +
      input.freshness * 0.15 +
      input.temporalRelevance * 0.15,
  );
}

export function isSceneEligible(scene: Scene, now = new Date()): boolean {
  if (scene.health.state !== "live") return false;
  const lastFrameAge = now.getTime() - new Date(scene.health.lastFrameAt).getTime();
  const analysisAge = now.getTime() - new Date(scene.analysis.observedAt).getTime();
  return (
    lastFrameAge >= -30_000 &&
    lastFrameAge <= 90_000 &&
    analysisAge >= -30_000 &&
    analysisAge <= FRESHNESS_WINDOW_MS
  );
}

export function rankScenes(
  scenes: Scene[],
  options: {
    limit?: number;
    previous?: RankingSnapshot | undefined;
    now?: Date;
    diversify?: boolean;
    score?: "channel" | "editorial";
  } = {},
): RankingEntry[] {
  const limit = options.limit ?? 10;
  const now = options.now ?? new Date();
  const previousRanks = new Map(
    (options.previous?.entries ?? []).map((entry) => [entry.scene.id, entry.rank]),
  );
  const scoreOf = (scene: Scene) =>
    options.score === "channel"
      ? scene.analysis.channelScore
      : scene.analysis.editorialScore;

  const candidates = scenes
    .filter((scene) => isSceneEligible(scene, now))
    .map((scene) => ({
      scene,
      stabilityBonus: previousRanks.has(scene.id)
        ? Math.max(0, 11 - (previousRanks.get(scene.id) ?? 11)) * 0.3
        : 0,
    }))
    .sort(
      (a, b) =>
        scoreOf(b.scene) + b.stabilityBonus - (scoreOf(a.scene) + a.stabilityBonus) ||
        a.scene.id.localeCompare(b.scene.id),
    );

  const selected: Scene[] = [];
  const channelCounts = new Map<SceneChannel, number>();
  const countryCounts = new Map<string, number>();

  while (selected.length < limit && candidates.length > 0) {
    if (options.diversify === false) {
      const picked = candidates.shift();
      if (!picked) break;
      selected.push(picked.scene);
      continue;
    }
    const lastChannel = selected.at(-1)?.primaryChannel;
    let candidateIndex = candidates.findIndex(({ scene }) => {
      const withinCaps =
        (channelCounts.get(scene.primaryChannel) ?? 0) < MAX_PER_CHANNEL &&
        (countryCounts.get(scene.countryCode) ?? 0) < MAX_PER_COUNTRY;
      return withinCaps && scene.primaryChannel !== lastChannel;
    });

    if (candidateIndex < 0) {
      candidateIndex = candidates.findIndex(
        ({ scene }) =>
          (channelCounts.get(scene.primaryChannel) ?? 0) < MAX_PER_CHANNEL &&
          (countryCounts.get(scene.countryCode) ?? 0) < MAX_PER_COUNTRY,
      );
    }

    if (candidateIndex < 0) break;
    const picked = candidates.splice(candidateIndex, 1)[0];
    if (!picked) break;
    selected.push(picked.scene);
    channelCounts.set(
      picked.scene.primaryChannel,
      (channelCounts.get(picked.scene.primaryChannel) ?? 0) + 1,
    );
    countryCounts.set(
      picked.scene.countryCode,
      (countryCounts.get(picked.scene.countryCode) ?? 0) + 1,
    );
  }

  return selected.map((scene, index) => {
    const rank = index + 1;
    const previousRank = previousRanks.get(scene.id) ?? null;
    return {
      rank,
      previousRank,
      trend:
        previousRank === null
          ? "new"
          : previousRank === rank
            ? "steady"
            : previousRank > rank
              ? "up"
              : "down",
      scene,
    };
  });
}

function roundScore(value: number): number {
  return Math.round(value * 10) / 10;
}
