import { Queue, Worker } from "bullmq";
import IORedis from "ioredis";
import { calculateChannelScore, calculateEditorialScore } from "@liveearth/domain/ranking";
import { nightTemporalRelevance } from "@liveearth/domain/solar";
import { VisionAnalyzer } from "./adapters/openai-vision";
import { fetchCurrentWeather } from "./adapters/open-meteo";
import { loadConfig } from "./config";
import { captureContactSheet } from "./media/contact-sheet";
import { probeStream } from "./media/probe";
import { EarthRepository } from "./repository";

const config = loadConfig();
const connection = new IORedis(config.REDIS_URL, { maxRetriesPerRequest: null });
const queue = new Queue("liveearth", { connection });
const repository = new EarthRepository(
  config.NEXT_PUBLIC_SUPABASE_URL,
  config.SUPABASE_SERVICE_ROLE_KEY,
);
const vision = new VisionAnalyzer(config.OPENAI_API_KEY, config.OPENAI_VISION_MODEL);

await queue.setGlobalConcurrency(1);
await queue.upsertJobScheduler(
  "probe-sources",
  { every: config.LIVE_EARTH_SAMPLE_INTERVAL_SECONDS * 1_000 },
  { name: "probe-sources", data: {} },
);
await queue.upsertJobScheduler(
  "publish-edition",
  { every: config.LIVE_EARTH_RANKING_INTERVAL_SECONDS * 1_000 },
  { name: "publish-edition", data: {} },
);

const worker = new Worker(
  "liveearth",
  async (job) => {
    if (job.name === "probe-sources") {
      const feeds = await repository.listActiveFeeds();
      for (let offset = 0; offset < feeds.length; offset += 4) {
        await Promise.all(
          feeds
            .slice(offset, offset + 4)
            .map(async (feed) => repository.saveProbe(feed.id, await probeStream(feed.source_url))),
        );
      }
      return { checked: feeds.length };
    }
    if (job.name === "publish-edition") {
      const targets = await repository.listAnalysisTargets(8);
      const results: PromiseSettledResult<void>[] = [];
      for (let offset = 0; offset < targets.length; offset += 2) {
        const batch = await Promise.allSettled(
          targets.slice(offset, offset + 2).map(async ({ publishedSceneId, scene, feed }) => {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 12_000);
            const weatherPromise = fetchCurrentWeather({
              latitude: feed.latitude,
              longitude: feed.longitude,
              apiKey: config.OPEN_METEO_API_KEY,
              signal: controller.signal,
            }).finally(() => clearTimeout(timeout));
            const sheetPromise = captureContactSheet(feed.source_url);
            const [weather, contactSheetDataUrl] = await Promise.all([
              weatherPromise,
              sheetPromise,
            ]);
            const observation = await vision.analyze({
              contactSheetDataUrl,
              channel: scene.primaryChannel,
              weather,
              location: `${scene.city}, ${scene.country}`,
            });
            const channelScore = calculateChannelScore(observation.breakdown);
            const editorialScore = calculateEditorialScore({
              channelScore,
              rarity: observation.breakdown.rarity,
              freshness: 100,
              temporalRelevance:
                scene.primaryChannel === "night"
                  ? nightTemporalRelevance(new Date(), scene.latitude, scene.longitude)
                  : 90,
            });
            const observedAt = new Date().toISOString();
            await repository.saveAnalysis(publishedSceneId, {
              ...scene,
              analysis: {
                observedAt,
                expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
                channelScore,
                editorialScore,
                breakdown: observation.breakdown,
                labels: observation.labels,
                reason: observation.reason,
                confidence: observation.confidence,
                evidence: observation.evidence,
                weather,
              },
            });
          }),
        );
        results.push(...batch);
      }
      const failed = results.filter((result) => result.status === "rejected");
      if (failed.length > 0) {
        console.error(JSON.stringify({ level: "warn", event: "analysis.partial", failed: failed.length }));
      }
      for (let offset = 0; offset < targets.length; offset += 4) {
        await Promise.all(
          targets.slice(offset, offset + 4).map(async ({ feed }) =>
            repository.saveProbe(feed.id, await probeStream(feed.source_url)),
          ),
        );
      }
      await repository.publishRankings();
      return {
        attempted: targets.length,
        completed: targets.length - failed.length,
        published: true,
      };
    }
    throw new Error(`Unknown job: ${job.name}`);
  },
  // Probe and edition jobs both update scene payloads; one job at a time keeps those writes ordered.
  { connection, concurrency: 1 },
);

worker.on("completed", (job) => {
  console.info(JSON.stringify({ level: "info", event: "job.completed", job: job.name, id: job.id }));
});
worker.on("failed", (job, error) => {
  console.error(
    JSON.stringify({ level: "error", event: "job.failed", job: job?.name, id: job?.id, error: error.message }),
  );
});

async function shutdown(signal: string) {
  console.info(JSON.stringify({ level: "info", event: "worker.shutdown", signal }));
  await worker.close();
  await queue.close();
  await connection.quit();
  process.exit(0);
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

console.info(JSON.stringify({ level: "info", event: "worker.ready", concurrency: 1 }));
