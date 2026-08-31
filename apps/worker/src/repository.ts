import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Channel, RankingSnapshot, Scene, SceneChannel, StreamProbeResult } from "@liveearth/domain/types";
import { rankScenes } from "@liveearth/domain/ranking";
import { isAfterCivilDusk } from "@liveearth/domain/solar";

export interface FeedRow {
  id: string;
  name: string;
  source_url: string;
  latitude: number;
  longitude: number;
  timezone: string;
  channels: SceneChannel[];
  rights_expires_at: string;
  state: "pending" | "live" | "degraded" | "offline" | "disabled";
}

export interface AnalysisTarget {
  publishedSceneId: string;
  scene: Scene;
  feed: FeedRow;
}

export class EarthRepository {
  private readonly client: SupabaseClient;

  constructor(url: string, serviceRoleKey: string) {
    this.client = createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  async listActiveFeeds(): Promise<FeedRow[]> {
    const { data, error } = await this.client
      .from("feeds")
      .select("id,name,source_url,latitude,longitude,timezone,channels,rights_expires_at,state")
      .neq("state", "disabled")
      .gt("rights_expires_at", new Date().toISOString());
    if (error) throw error;
    return data as FeedRow[];
  }

  async saveProbe(feedId: string, probe: StreamProbeResult): Promise<void> {
    const state = probe.ok ? (probe.flags.includes("low-bitrate") ? "degraded" : "live") : "offline";
    const { error: feedError } = await this.client
      .from("feeds")
      .update({ state, updated_at: probe.checkedAt })
      .eq("id", feedId);
    if (feedError) throw feedError;

    const { data: sceneRow, error: sceneReadError } = await this.client
      .from("published_scenes")
      .select("payload")
      .eq("feed_id", feedId)
      .maybeSingle();
    if (sceneReadError) throw sceneReadError;
    if (!sceneRow) return;

    const current = sceneRow.payload as Scene;
    const lastFrameAt = probe.ok ? probe.checkedAt : current.health.lastFrameAt;
    const payload: Scene = {
      ...current,
      health: {
        state,
        checkedAt: probe.checkedAt,
        lastFrameAt,
        latencyMs: probe.latencyMs,
        bitrateKbps: probe.bitrateKbps,
        consecutiveFailures: probe.ok ? 0 : current.health.consecutiveFailures + 1,
        flags: probe.flags,
      },
    };
    const analysisIsFresh =
      new Date(current.analysis.expiresAt).getTime() >= new Date(probe.checkedAt).getTime();
    const { error: sceneWriteError } = await this.client
      .from("published_scenes")
      .update({
        payload,
        last_frame_at: lastFrameAt,
        is_publishable: state === "live" && analysisIsFresh,
        updated_at: probe.checkedAt,
      })
      .eq("feed_id", feedId);
    if (sceneWriteError) throw sceneWriteError;
  }

  async listPublishableScenes(): Promise<Scene[]> {
    const { data, error } = await this.client
      .from("published_scenes")
      .select("payload")
      .eq("is_publishable", true);
    if (error) throw error;
    return data.map((row) => row.payload as Scene);
  }

  async listAnalysisTargets(limit = 8): Promise<AnalysisTarget[]> {
    const { data, error } = await this.client
      .from("published_scenes")
      .select(
        "id,payload,feed:feeds!inner(id,name,source_url,latitude,longitude,timezone,channels,rights_expires_at,state)",
      )
      .eq("feed.state", "live")
      .gt("feed.rights_expires_at", new Date().toISOString())
      .order("analysis_observed_at", { ascending: true })
      .limit(limit);
    if (error) throw error;
    return data.map((row) => ({
      publishedSceneId: row.id,
      scene: row.payload as Scene,
      feed: row.feed as unknown as FeedRow,
    }));
  }

  async saveAnalysis(publishedSceneId: string, scene: Scene): Promise<void> {
    const { data: currentRow, error: readError } = await this.client
      .from("published_scenes")
      .select("payload")
      .eq("id", publishedSceneId)
      .single();
    if (readError) throw readError;
    const current = currentRow.payload as Scene;
    const cutoff = new Date(scene.analysis.observedAt).getTime() - 24 * 60 * 60_000;
    const payload: Scene = {
      ...scene,
      health: {
        ...current.health,
        state: "live",
        checkedAt: scene.analysis.observedAt,
        lastFrameAt: scene.analysis.observedAt,
        consecutiveFailures: 0,
      },
      scoreHistory: [
        ...current.scoreHistory,
        { at: scene.analysis.observedAt, score: scene.analysis.editorialScore },
      ]
        .filter((point) => new Date(point.at).getTime() >= cutoff)
        .slice(-288),
    };
    const frameIsFresh =
      new Date(payload.health.lastFrameAt).getTime() >=
      new Date(scene.analysis.observedAt).getTime() - 90_000;
    const { error } = await this.client
      .from("published_scenes")
      .update({
        payload,
        analysis_observed_at: payload.analysis.observedAt,
        last_frame_at: payload.health.lastFrameAt,
        is_publishable: payload.health.state === "live" && frameIsFresh,
        updated_at: new Date().toISOString(),
      })
      .eq("id", publishedSceneId);
    if (error) throw error;
  }

  async latestRanking(channel: Channel): Promise<RankingSnapshot | undefined> {
    const { data } = await this.client
      .from("ranking_snapshots")
      .select("payload")
      .eq("channel", channel)
      .order("generated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return data?.payload as RankingSnapshot | undefined;
  }

  async publishRankings(now = new Date()): Promise<void> {
    const scenes = await this.listPublishableScenes();
    const channels: Channel[] = ["earth", "storm", "ocean", "night"];
    const versionTime = Math.floor(now.getTime() / 300_000) * 300_000;
    const rows = await Promise.all(
      channels.map(async (channel) => {
        const previous = await this.latestRanking(channel);
        const channelScenes = scenes.filter((scene) => {
          if (channel === "earth") return true;
          if (!scene.channels.includes(channel)) return false;
          if (channel === "night") {
            return isAfterCivilDusk(now, scene.latitude, scene.longitude);
          }
          if (channel === "storm") {
            const labels = scene.analysis.labels.join(" ").toLowerCase();
            return (
              scene.analysis.weather.weatherCode >= 95 ||
              /lightning|thunder|storm|squall|rain shaft/.test(labels)
            );
          }
          return true;
        });
        const snapshot: RankingSnapshot = {
          channel,
          rankingVersion: `${channel}-${new Date(versionTime).toISOString()}`,
          generatedAt: new Date(versionTime).toISOString(),
          nextRefreshAt: new Date(versionTime + 300_000).toISOString(),
          entries: rankScenes(channelScenes, {
            limit: 10,
            previous,
            now,
            diversify: channel === "earth",
            score: channel === "earth" ? "editorial" : "channel",
          }),
          isDemo: false,
        };
        return {
          channel,
          version: snapshot.rankingVersion,
          payload: snapshot,
          generated_at: snapshot.generatedAt,
          next_refresh_at: snapshot.nextRefreshAt,
        };
      }),
    );
    const { error } = await this.client.from("ranking_snapshots").insert(rows);
    if (error && error.code !== "23505") throw error;
  }
}
