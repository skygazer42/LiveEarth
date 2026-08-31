import "server-only";

import { cache } from "react";
import { createClient } from "@supabase/supabase-js";
import { createDemoRanking, createDemoScenes } from "@liveearth/domain/fixtures";
import { isSceneEligible } from "@liveearth/domain/ranking";
import type { Channel, GlobePoint, RankingSnapshot, Scene } from "@liveearth/domain/types";
import { isDemoMode } from "./demo-mode";

function emptySnapshot(channel: Channel): RankingSnapshot {
  const now = new Date();
  return {
    channel,
    rankingVersion: `empty-${channel}-${now.toISOString()}`,
    generatedAt: now.toISOString(),
    nextRefreshAt: new Date(now.getTime() + 5 * 60_000).toISOString(),
    entries: [],
    isDemo: false,
  };
}

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export const getRankingSnapshot = cache(async (channel: Channel): Promise<RankingSnapshot> => {
  if (isDemoMode()) return createDemoRanking(channel);

  const supabase = serviceClient();
  if (!supabase) return emptySnapshot(channel);
  const { data, error } = await supabase
    .from("ranking_snapshots")
    .select("payload")
    .eq("channel", channel)
    .order("generated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return emptySnapshot(channel);
  const snapshot = data.payload as RankingSnapshot;
  const now = new Date();
  if (now.getTime() - new Date(snapshot.generatedAt).getTime() > 10 * 60_000) {
    return emptySnapshot(channel);
  }
  if (snapshot.entries.length === 0) return snapshot;

  const sceneIds = snapshot.entries.map((entry) => entry.scene.id);
  const { data: sceneRows, error: sceneError } = await supabase
    .from("published_scenes")
    .select("id,payload")
    .in("id", sceneIds)
    .eq("is_publishable", true);
  if (sceneError) return emptySnapshot(channel);
  const liveScenes = new Map(
    sceneRows.map((row) => [row.id, row.payload as Scene]),
  );
  return {
    ...snapshot,
    entries: snapshot.entries
      .flatMap((entry) => {
        const scene = liveScenes.get(entry.scene.id);
        return scene && isSceneEligible(scene, now) ? [{ ...entry, scene }] : [];
      })
      .map((entry, index) => ({ ...entry, rank: index + 1 })),
  };
});

export const getSceneBySlug = cache(async (slug: string): Promise<Scene | null> => {
  if (isDemoMode()) {
    return createDemoScenes().find((scene) => scene.slug === slug) ?? null;
  }

  const supabase = serviceClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("published_scenes")
    .select("payload")
    .eq("slug", slug)
    .eq("is_publishable", true)
    .maybeSingle();
  if (error || !data) return null;
  const scene = data.payload as Scene;
  return isSceneEligible(scene) ? scene : null;
});

export async function getGlobePoints(channel: Channel): Promise<GlobePoint[]> {
  const snapshot = await getRankingSnapshot(channel);
  return snapshot.entries.map(({ rank, scene }) => ({
    sceneId: scene.id,
    slug: scene.slug,
    latitude: scene.latitude,
    longitude: scene.longitude,
    channel: scene.primaryChannel,
    rank,
    score: scene.analysis.editorialScore,
    label: `${scene.city}, ${scene.country}`,
    state: scene.health.state,
  }));
}

export async function getAllScenes(): Promise<Scene[]> {
  if (isDemoMode()) return createDemoScenes();
  const supabase = serviceClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("published_scenes")
    .select("payload")
    .eq("is_publishable", true)
    .order("updated_at", { ascending: false })
    .limit(100);
  if (error) return [];
  const now = new Date();
  return data
    .map((row) => row.payload as Scene)
    .filter((scene) => isSceneEligible(scene, now));
}
